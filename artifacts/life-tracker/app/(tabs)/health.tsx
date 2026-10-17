import React, { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useIdentifyExerciseMachine } from "@workspace/api-client-react";
import { ActionButton, Card, EmptyState, Field, Page, PageHeading, SectionTitle } from "../../src/components/primitives";
import { localDateKey, makeId, useLife } from "../../src/state/LifeContext";
import { useColors } from "../../hooks/useColors";

type FoodResult = {
  id: string;
  name: string;
  source: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function nutrientValue(list: Array<{ nutrientName?: string; nutrientNumber?: string; nutrientId?: number; value?: number; unitName?: string }> | undefined, kind: "calories" | "protein" | "carbs" | "fat") {
  const candidates = list ?? [];
  if (kind === "calories") {
    const directCalories = candidates.find((item) =>
      /energy|calorie/i.test(item.nutrientName ?? "") && /kcal/i.test(item.unitName ?? ""),
    );
    if (directCalories) return Math.max(0, Number(directCalories.value ?? 0));
    const energy = candidates.find((item) => /energy|calorie/i.test(item.nutrientName ?? ""));
    if (energy && /kj/i.test(energy.unitName ?? "")) {
      return Math.max(0, Number(energy.value ?? 0) / 4.184);
    }
    return Math.max(0, Number(energy?.value ?? 0));
  }
  const patterns: Record<typeof kind, RegExp> = {
    protein: /protein/i,
    carbs: /carbohydrate/i,
    fat: /total lipid|total fat/i,
  };
  const found = candidates.find((item) => patterns[kind].test(item.nutrientName ?? ""));
  return Math.max(0, Number(found?.value ?? 0));
}

async function searchNutrition(query: string): Promise<FoodResult[]> {
  const results: FoodResult[] = [];
  const fdc = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  fdc.searchParams.set("query", query);
  fdc.searchParams.set("api_key", "DEMO_KEY");
  fdc.searchParams.set("pageSize", "5");
  fdc.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");

  try {
    const response = await fetch(fdc.toString());
    if (response.ok) {
      const body = await response.json() as {
        foods?: Array<{ fdcId: number; description: string; foodNutrients?: Array<{ nutrientName?: string; nutrientNumber?: string; nutrientId?: number; value?: number }> }>;
      };
      for (const item of body.foods ?? []) {
        const calories = nutrientValue(item.foodNutrients, "calories");
        if (!item.description || calories <= 0) continue;
        results.push({
          id: `usda-${item.fdcId}`,
          name: item.description,
          source: "USDA FoodData Central",
          calories,
          protein: nutrientValue(item.foodNutrients, "protein"),
          carbs: nutrientValue(item.foodNutrients, "carbs"),
          fat: nutrientValue(item.foodNutrients, "fat"),
        });
      }
    }
  } catch {
    // Branded product search below remains available if USDA is unreachable.
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&page_size=5&fields=code,product_name,brands,nutriments`;
    const response = await fetch(url, { headers: { "User-Agent": "LifeTracker/1.0 (personal food logging)" } });
    if (response.ok) {
      const body = await response.json() as {
        products?: Array<{ code?: string; product_name?: string; brands?: string; nutriments?: Record<string, number> }>;
      };
      for (const product of body.products ?? []) {
        const nutrition = product.nutriments ?? {};
        const calories = Number(nutrition["energy-kcal_100g"] ?? nutrition["energy-kcal_value"] ?? 0);
        if (!product.product_name || calories <= 0) continue;
        results.push({
          id: `off-${product.code ?? makeId()}`,
          name: product.brands ? `${product.product_name} · ${product.brands}` : product.product_name,
          source: "Open Food Facts",
          calories,
          protein: Number(nutrition["proteins_100g"] ?? 0),
          carbs: Number(nutrition["carbohydrates_100g"] ?? 0),
          fat: Number(nutrition["fat_100g"] ?? 0),
        });
      }
    }
  } catch {
    // The official USDA results still provide a usable generic-food search.
  }
  return results;
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ProgressGraph({ values }: { values: number[] }) {
  const colors = useColors();
  const width = 280;
  const height = 92;
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 20) + 10;
    const y = height - 12 - ((value - min) / span) * (height - 24);
    return `${x},${y}`;
  }).join(" ");
  return (
    <View style={styles.graphWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline points={points} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {values.map((value, index) => {
          const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 20) + 10;
          const y = height - 12 - ((value - min) / span) * (height - 24);
          return <Circle key={`${value}-${index}`} cx={x} cy={y} r={4} fill={colors.card} stroke={colors.primary} strokeWidth={2} />;
        })}
      </Svg>
      <View style={styles.graphLabels}>
        <Text style={[styles.dataCaption, { color: colors.mutedForeground }]}>{values.length} recent sessions</Text>
        <Text style={[styles.dataCaption, { color: colors.mutedForeground }]}>{min === max ? `${max} kg` : `${min}–${max} kg`}</Text>
      </View>
    </View>
  );
}

export default function HealthScreen() {
  const { data, update } = useLife();
  const colors = useColors();
  const identifyRequest = useIdentifyExerciseMachine();
  const [section, setSection] = useState<"food" | "training">("food");
  const [search, setSearch] = useState("");
  const [foodResults, setFoodResults] = useState<FoodResult[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");
  const [grams, setGrams] = useState("100");
  const [mealTime, setMealTime] = useState(timeNow());
  const [manualFood, setManualFood] = useState(false);
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [finishTime, setFinishTime] = useState(timeNow());
  const [photoUri, setPhotoUri] = useState("");
  const [cameraCanAskAgain, setCameraCanAskAgain] = useState(true);
  const [photoSuggestion, setPhotoSuggestion] = useState("");
  const [exerciseError, setExerciseError] = useState("");
  const todayMeals = data.meals.filter((meal) => meal.date === localDateKey());
  const dailyCalories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const dailyProtein = todayMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const trackedExercise = data.workouts.find((entry) => entry.exercise.toLowerCase() === exercise.trim().toLowerCase())?.exercise;
  const exerciseHistory = useMemo(() => {
    const currentName = trackedExercise ?? exercise.trim();
    if (!currentName) return [];
    return data.workouts
      .filter((entry) => entry.exercise.toLowerCase() === currentName.toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8);
  }, [data.workouts, exercise, trackedExercise]);

  const searchFoods = async () => {
    if (!search.trim()) return;
    setFoodLoading(true);
    setFoodError("");
    setFoodResults([]);
    setManualFood(false);
    try {
      const results = await searchNutrition(search.trim());
      setFoodResults(results);
      if (!results.length) setFoodError("No matching nutrition entries found. You can enter the macros from a verified label.");
    } catch {
      setFoodError("Nutrition search is unavailable. You can enter the macros from the food label.");
    } finally {
      setFoodLoading(false);
    }
  };

  const addMeal = (food: FoodResult) => {
    const amount = Number(grams);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFoodError("Enter a valid portion in grams first.");
      return;
    }
    const factor = amount / 100;
    update("meals", [{
      id: makeId(),
      name: food.name,
      grams: amount,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fat: Math.round(food.fat * factor * 10) / 10,
      time: mealTime || timeNow(),
      date: localDateKey(),
      source: food.source,
    }, ...data.meals]);
    setSearch("");
    setFoodResults([]);
  };

  const addManualMeal = () => {
    const amount = Number(grams);
    const calories = Number(manualCalories);
    const protein = Number(manualProtein);
    const carbs = Number(manualCarbs);
    const fat = Number(manualFat);
    if (!search.trim() || !Number.isFinite(amount) || amount <= 0 || [calories, protein, carbs, fat].some((value) => !Number.isFinite(value) || value < 0)) {
      setFoodError("Enter a food name, portion, calories and valid macros.");
      return;
    }
    update("meals", [{
      id: makeId(),
      name: search.trim(),
      grams: amount,
      calories,
      protein,
      carbs,
      fat,
      time: mealTime || timeNow(),
      date: localDateKey(),
      source: "Food label / manual",
    }, ...data.meals]);
    setSearch("");
    setManualFood(false);
  };

  const takeMachinePhoto = async () => {
    setExerciseError("");
    setPhotoSuggestion("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setCameraCanAskAgain(permission.canAskAgain);
        setExerciseError("Camera access is needed to identify equipment. You can still enter the exercise name manually.");
        return;
      }
      setCameraCanAskAgain(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.35,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      let durableUri = asset.uri;
      if (Platform.OS !== "web" && FileSystem.documentDirectory) {
        try {
          durableUri = `${FileSystem.documentDirectory}equipment-${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: asset.uri, to: durableUri });
        } catch {
          durableUri = asset.uri;
          setExerciseError("The photo is available for this session, but could not be saved permanently.");
        }
      }
      setPhotoUri(durableUri);
      if (asset.base64) {
        const identified = await identifyRequest.mutateAsync({
          data: { imageBase64: asset.base64, mimeType: "image/jpeg" },
        });
        setPhotoSuggestion(identified.suggestion);
        const likelyName = identified.suggestion.split(/[.\n]/)[0].replace(/^likely (an? )?/i, "").trim();
        if (likelyName) setExercise(likelyName);
      }
    } catch (error) {
      setExerciseError(error instanceof Error ? error.message : "Could not use this photo.");
    }
  };

  const addWorkout = () => {
    const weightValue = Number(weight);
    const repValue = Number(reps);
    const setValue = Number(sets);
    if (!exercise.trim() || !Number.isFinite(weightValue) || weightValue < 0 || !Number.isInteger(repValue) || repValue < 1 || !Number.isInteger(setValue) || setValue < 1) {
      setExerciseError("Add an exercise name, weight, reps and sets.");
      return;
    }
    update("workouts", [{
      id: makeId(),
      exercise: exercise.trim(),
      weight: weightValue,
      reps: repValue,
      sets: setValue,
      finishedAt: finishTime || timeNow(),
      date: localDateKey(),
      photoUri: photoUri || undefined,
    }, ...data.workouts]);
    setWeight("");
    setReps("");
    setSets("");
    setFinishTime(timeNow());
    setPhotoUri("");
    setPhotoSuggestion("");
    setExerciseError("");
  };

  return (
    <Page>
      <PageHeading eyebrow="Nutrition & training" title="Care for your energy." subtitle="Meals, macros and strength in one place." />
      <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
        {(["food", "training"] as const).map((item) => {
          const active = section === item;
          return (
            <Pressable key={item} onPress={() => setSection(item)} style={[styles.segmentItem, { backgroundColor: active ? colors.primary : "transparent" }]}>
              <Text style={[styles.segmentText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{item === "food" ? "Food & macros" : "Gym progress"}</Text>
            </Pressable>
          );
        })}
      </View>

      {section === "food" ? (
        <>
          <Card>
            <SectionTitle detail="Today">Nutrition at a glance</SectionTitle>
            <View style={styles.macroStats}>
              <View style={styles.macroMain}>
                <Text style={[styles.macroNumber, { color: colors.foreground }]}>{Math.round(dailyCalories).toLocaleString()}</Text>
                <Text style={[styles.smallCaption, { color: colors.mutedForeground }]}>of {data.settings.calorieTarget.toLocaleString()} kcal</Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.min(100, dailyCalories / Math.max(1, data.settings.calorieTarget) * 100)}%` }]} /></View>
              </View>
              <View style={styles.proteinBox}>
                <Text style={[styles.proteinValue, { color: colors.foreground }]}>{Math.round(dailyProtein)} g</Text>
                <Text style={[styles.smallCaption, { color: colors.mutedForeground }]}>protein · {data.settings.proteinTarget} g goal</Text>
              </View>
            </View>
            <View style={styles.macroRow}>
              <Text style={[styles.macroText, { color: colors.mutedForeground }]}>Carbs <Text style={[styles.macroStrong, { color: colors.foreground }]}>{Math.round(todayMeals.reduce((sum, meal) => sum + meal.carbs, 0))} g</Text></Text>
              <Text style={[styles.macroText, { color: colors.mutedForeground }]}>Fat <Text style={[styles.macroStrong, { color: colors.foreground }]}>{Math.round(todayMeals.reduce((sum, meal) => sum + meal.fat, 0))} g</Text></Text>
            </View>
          </Card>
          <Card>
            <SectionTitle>Log a meal</SectionTitle>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Search official USDA FoodData Central for generic foods and Open Food Facts for branded products. Nutrition is scaled from 100 g to your portion.</Text>
            <Field label="Food or product" value={search} onChangeText={setSearch} placeholder="e.g. Greek yogurt or a product name" />
            <View style={styles.formRow}>
              <View style={styles.formHalf}><Field label="Portion (g)" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder="100" /></View>
              <View style={styles.formHalf}><Field label="What time did you eat?" value={mealTime} onChangeText={setMealTime} placeholder="13:00" /></View>
            </View>
            <ActionButton label="Search food data" icon="search" onPress={searchFoods} loading={foodLoading} disabled={!search.trim()} />
            {foodError ? <Text style={[styles.error, { color: colors.destructive }]}>{foodError}</Text> : null}
            {foodResults.map((food) => (
              <View key={food.id} style={[styles.foodResult, { borderTopColor: colors.border }]}>
                <View style={styles.foodCopy}>
                  <Text style={[styles.foodName, { color: colors.foreground }]}>{food.name}</Text>
                  <Text style={[styles.smallCaption, { color: colors.mutedForeground }]}>{food.source} · per 100 g · {Math.round(food.calories)} kcal · P {food.protein} g · C {food.carbs} g · F {food.fat} g</Text>
                </View>
                <Pressable onPress={() => addMeal(food)} accessibilityLabel={`Log ${food.name}`} style={[styles.logFood, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.logFoodText, { color: colors.foreground }]}>Log</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setManualFood((value) => !value)} style={styles.manualToggle}>
              <Text style={[styles.manualText, { color: colors.foreground }]}>{manualFood ? "Hide manual entry" : "Enter macros from a food label"}</Text>
            </Pressable>
            {manualFood ? (
              <View style={styles.manualBox}>
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>Enter macros for the full portion above, not per 100 g.</Text>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><Field label="Calories (kcal)" value={manualCalories} onChangeText={setManualCalories} keyboardType="decimal-pad" placeholder="0" /></View>
                  <View style={styles.formHalf}><Field label="Protein (g)" value={manualProtein} onChangeText={setManualProtein} keyboardType="decimal-pad" placeholder="0" /></View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><Field label="Carbs (g)" value={manualCarbs} onChangeText={setManualCarbs} keyboardType="decimal-pad" placeholder="0" /></View>
                  <View style={styles.formHalf}><Field label="Fat (g)" value={manualFat} onChangeText={setManualFat} keyboardType="decimal-pad" placeholder="0" /></View>
                </View>
                <ActionButton label="Save meal" icon="check" onPress={addManualMeal} />
              </View>
            ) : null}
          </Card>
          <Card>
            <SectionTitle detail={`${todayMeals.length} logged`}>Today’s meals</SectionTitle>
            {todayMeals.length ? todayMeals.map((meal) => (
              <View key={meal.id} style={[styles.mealRow, { borderTopColor: colors.border }]}>
                <View style={styles.mealCopy}>
                  <Text style={[styles.foodName, { color: colors.foreground }]}>{meal.name}</Text>
                  <Text style={[styles.smallCaption, { color: colors.mutedForeground }]}>{meal.time} · {meal.grams} g · {meal.source}</Text>
                </View>
                <View style={styles.mealMacros}>
                  <Text style={[styles.foodKcal, { color: colors.foreground }]}>{Math.round(meal.calories)} kcal</Text>
                  <Text style={[styles.smallCaption, { color: colors.mutedForeground }]}>P {meal.protein} · C {meal.carbs} · F {meal.fat}</Text>
                </View>
                <Pressable accessibilityLabel={`Remove ${meal.name}`} onPress={() => update("meals", data.meals.filter((item) => item.id !== meal.id))} style={styles.remove}>
                  <Text style={{ color: colors.mutedForeground }}>×</Text>
                </Pressable>
              </View>
            )) : <EmptyState title="Your meals will show up here" detail="Search a food or enter the numbers from its verified label." />}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <SectionTitle>Log your workout</SectionTitle>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Take a machine photo to get an AI equipment suggestion, then record weight, reps and sets.</Text>
            <ActionButton label={identifyRequest.isPending ? "Identifying equipment…" : "Photograph equipment"} icon="camera" onPress={takeMachinePhoto} secondary loading={identifyRequest.isPending} testID="equipment-photo" />
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.machinePhoto} resizeMode="cover" /> : null}
            {photoSuggestion ? <View style={[styles.suggestion, { backgroundColor: colors.secondary }]}><Text style={[styles.helper, { color: colors.foreground }]}>{photoSuggestion}</Text></View> : null}
            <Field label="Exercise or machine" value={exercise} onChangeText={setExercise} placeholder="e.g. Seated row" />
            <View style={styles.formRow}>
              <View style={styles.formHalf}><Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0" /></View>
              <View style={styles.formHalf}><Field label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="0" /></View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formHalf}><Field label="Sets" value={sets} onChangeText={setSets} keyboardType="number-pad" placeholder="0" /></View>
              <View style={styles.formHalf}><Field label="What time did you finish?" value={finishTime} onChangeText={setFinishTime} placeholder="20:00" /></View>
            </View>
            {exerciseError ? <Text style={[styles.error, { color: colors.destructive }]}>{exerciseError}</Text> : null}
            {!cameraCanAskAgain && Platform.OS !== "web" ? (
              <View style={styles.permissionButton}>
                <ActionButton label="Open device settings" icon="settings" secondary onPress={() => { void Linking.openSettings().catch(() => setExerciseError("Device settings could not be opened.")); }} />
              </View>
            ) : null}
            <ActionButton label="Save workout" icon="check" onPress={addWorkout} disabled={!exercise.trim() || !weight || !reps || !sets} testID="save-workout" />
          </Card>
          <Card>
            <SectionTitle detail="Weight lifted">Progress graph</SectionTitle>
            {exerciseHistory.length ? (
              <>
                <Text style={[styles.foodName, { color: colors.foreground }]}>{exerciseHistory[exerciseHistory.length - 1]?.exercise}</Text>
                <ProgressGraph values={exerciseHistory.map((entry) => entry.weight)} />
                {exerciseHistory.slice().reverse().map((entry) => (
                  <View key={entry.id} style={[styles.workoutRow, { borderTopColor: colors.border }]}>
                    <View style={styles.mealCopy}>
                      <Text style={[styles.foodName, { color: colors.foreground }]}>{entry.weight} kg · {entry.sets} × {entry.reps}</Text>
                      <Text style={[styles.smallCaption, { color: colors.mutedForeground }]}>{entry.date} · finished {entry.finishedAt}</Text>
                    </View>
                    <Pressable accessibilityLabel="Delete workout" onPress={() => update("workouts", data.workouts.filter((item) => item.id !== entry.id))} style={styles.remove}>
                      <Text style={{ color: colors.mutedForeground }}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : <EmptyState title="Progress appears with each log" detail="Use the same exercise name each time to see your weight trend." />}
          </Card>
          {data.workouts.some((entry) => entry.photoUri) ? (
            <Card>
              <SectionTitle>Equipment photos</SectionTitle>
              <View style={styles.photoGrid}>
                {data.workouts.filter((entry) => entry.photoUri).slice(0, 6).map((entry) => (
                  <View key={entry.id} style={styles.photoItem}>
                    <Image source={{ uri: entry.photoUri }} style={styles.gridPhoto} resizeMode="cover" />
                    <Text numberOfLines={1} style={[styles.smallCaption, { color: colors.mutedForeground }]}>{entry.exercise}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", padding: 4, borderRadius: 14, marginBottom: 15 },
  permissionButton: { marginTop: 8 },
  segmentItem: { flex: 1, borderRadius: 11, paddingVertical: 10, alignItems: "center" },
  segmentText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  macroStats: { flexDirection: "row", gap: 14, alignItems: "center" },
  macroMain: { flex: 1 },
  macroNumber: { fontFamily: "Inter_700Bold", fontSize: 29, letterSpacing: -0.8 },
  smallCaption: { fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 15 },
  progressTrack: { height: 7, overflow: "hidden", borderRadius: 5, marginTop: 10 },
  progressFill: { height: 7, borderRadius: 5 },
  proteinBox: { minWidth: 100 },
  proteinValue: { fontFamily: "Inter_700Bold", fontSize: 19 },
  macroRow: { flexDirection: "row", gap: 20, marginTop: 16 },
  macroText: { fontFamily: "Inter_400Regular", fontSize: 11 },
  macroStrong: { fontFamily: "Inter_600SemiBold" },
  helper: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  formRow: { flexDirection: "row", gap: 10 },
  formHalf: { flex: 1 },
  error: { fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 18, marginVertical: 10 },
  foodResult: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  foodCopy: { flex: 1, gap: 4 },
  foodName: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18 },
  logFood: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 },
  logFoodText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  manualToggle: { alignSelf: "flex-start", paddingVertical: 10 },
  manualText: { fontFamily: "Inter_600SemiBold", fontSize: 11, textDecorationLine: "underline" },
  manualBox: { paddingTop: 5 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 11 },
  mealCopy: { flex: 1 },
  mealMacros: { alignItems: "flex-end", gap: 3 },
  foodKcal: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  remove: { width: 28, height: 30, alignItems: "center", justifyContent: "center" },
  machinePhoto: { width: "100%", height: 170, borderRadius: 14, marginTop: 13, marginBottom: 14 },
  suggestion: { padding: 11, borderRadius: 12, marginTop: 12 },
  graphWrap: { marginTop: 10, marginBottom: 4 },
  graphLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  dataCaption: { fontFamily: "Inter_400Regular", fontSize: 10 },
  workoutRow: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 4 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoItem: { width: "31%", gap: 5 },
  gridPhoto: { width: "100%", height: 82, borderRadius: 10 },
});
