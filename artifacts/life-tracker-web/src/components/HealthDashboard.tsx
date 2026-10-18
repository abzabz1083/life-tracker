import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Activity, Camera, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, FileText, Flame,
  Heart, LoaderCircle, Plus, Search, Sparkles, Trash2, TrendingUp, Utensils, X,
} from "lucide-react";
import {
  useCreateLifeMealPlan, useIdentifyExerciseMachine, useReadLifeNutritionLabel,
  searchLifeNutrition,
} from "@workspace/api-client-react";
import type { NutritionFood } from "@workspace/api-client-react";
import type { DayCheckIn, LifeData, Meal, MealIngredient, SavedFood, SavedMeal, WorkoutEntry } from "../lib/life-data";
import { dateKey, makeId } from "../lib/life-data";
import { loadMealPhoto, storeMealPhoto } from "../lib/meal-images";
import "./HealthDashboard.css";

type Props = { data: LifeData; update: <K extends keyof LifeData>(key: K, value: LifeData[K]) => void };
type MacroFood = Pick<NutritionFood, "id" | "name" | "source" | "calories" | "protein" | "carbs" | "fat">;
type LabelDraft = { name: string; servingGrams: number; calories: number; protein: number; carbs: number; fat: number; labelNotes: string };
type SuggestedFood = { food: string; grams: number; reason: string; matches: MacroFood[]; selected?: MacroFood; loading: boolean; error?: string };
type Tab = "food" | "training";
const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const todayKey = () => dateKey();
const round1 = (n: number) => Math.round(n * 10) / 10;
const macroText = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
const nutrientFactor = (amount: number, grams: number) => amount * grams / 100;
const toInputImage = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("This photo could not be prepared."); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("This photo could not be prepared.")), "image/jpeg", .84));
}
function openWorkoutImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("life-tracker-images", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workout-images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storeWorkoutImage(key: string, image: Blob): Promise<void> {
  const db = await openWorkoutImageDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workout-images", "readwrite");
      transaction.objectStore("workout-images").put(image, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
async function loadWorkoutImage(key: string): Promise<Blob | undefined> {
  const db = await openWorkoutImageDatabase();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db.transaction("workout-images").objectStore("workout-images").get(key);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
function fmtMonth(date: Date) { return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date); }
function Panel({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section className={`hd-panel ${className}`} id={id}>{children}</section>;
}
function PanelHeading({ icon, label, title, aside }: { icon?: React.ReactNode; label?: string; title: string; aside?: React.ReactNode }) {
  return <div className="hd-panel-heading"><div>{label && <span className="hd-kicker">{label}</span>}<h2>{icon}{title}</h2></div>{aside}</div>;
}
function Field({ label, value, onChange, type = "text", placeholder, min, step, id }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; min?: string; step?: string; id?: string;
}) {
  return <label className="hd-field" htmlFor={id}><span>{label}</span><input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} step={step}/></label>;
}
function Empty({ title, text }: { title: string; text: string }) {
  return <div className="hd-empty"><span className="hd-empty-mark"><Activity size={17}/></span><strong>{title}</strong><p>{text}</p></div>;
}
function ErrorNote({ children }: { children: React.ReactNode }) { return <p className="hd-error" role="alert">{children}</p>; }
function macros(food: Pick<MacroFood, "calories" | "protein" | "carbs" | "fat">, grams: number) {
  return { calories: Math.round(nutrientFactor(food.calories, grams)), protein: round1(nutrientFactor(food.protein, grams)), carbs: round1(nutrientFactor(food.carbs, grams)), fat: round1(nutrientFactor(food.fat, grams)) };
}
function targetStatus(current: number, target: number, mode: "limit" | "goal") {
  if (target <= 0) return { state: "unset", label: "Target not set" };
  if (mode === "goal") {
    return current >= target
      ? { state: "goal-met", label: "Goal reached" }
      : { state: "goal-in-progress", label: `${round1(target - current)} g to goal` };
  }
  const ratio = current / target;
  if (ratio > 1) return { state: "over", label: `${round1(current - target)} over target` };
  if (ratio >= .9) return { state: "near", label: "Near limit" };
  return { state: "on-track", label: "On track" };
}
function updateCheck(data: LifeData, update: Props["update"], date: string, field: "gym" | "diet", value: DayCheckIn["gym"] | DayCheckIn["diet"]) {
  const existing = data.dayChecks.find(item => item.date === date);
  const next = { date, gym: existing?.gym ?? null, diet: existing?.diet ?? null, [field]: value } as DayCheckIn;
  const checks = data.dayChecks.filter(item => item.date !== date);
  if (next.gym || next.diet) checks.push(next);
  update("dayChecks", checks);
}
function streakFor(checks: DayCheckIn[], kind: "gym" | "diet") {
  const qualified = kind === "gym" ? "went" : "good";
  const dates = new Set(checks.filter(check => check[kind] === qualified).map(check => check.date));
  let cursor = new Date(); cursor.setHours(12, 0, 0, 0);
  if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(dateKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function formatTrend(history: WorkoutEntry[]) {
  if (history.length < 2) return "Log this lift again to start seeing your trend.";
  const first = history[0].weight, last = history[history.length - 1].weight;
  if (last > first) return `You’ve added ${round1(last - first)} kg since your earliest recent session. Keep building at your own pace.`;
  if (last < first) return `Your recent logged weight is ${round1(first - last)} kg lighter. A useful snapshot—not a verdict on your progress.`;
  return "Your recent sessions are holding steady. Consistency is progress too.";
}

export function HealthDashboard({ data, update }: Props) {
  const [tab, setTab] = useState<Tab>("food");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MacroFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [foodError, setFoodError] = useState("");
  const [grams, setGrams] = useState("100");
  const [mealTime, setMealTime] = useState(nowTime);
  const [manual, setManual] = useState(false);
  const [manualValues, setManualValues] = useState(["", "", "", ""]);
  const [labelDraft, setLabelDraft] = useState<LabelDraft | null>(null);
  const [labelPhoto, setLabelPhoto] = useState<Blob | null>(null);
  const [labelPreview, setLabelPreview] = useState("");
  const [labelError, setLabelError] = useState("");
  const [foodPhotoUrls, setFoodPhotoUrls] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateSearch, setTemplateSearch] = useState<MacroFood[]>([]);
  const [templateGrams, setTemplateGrams] = useState("100");
  const [templateIngredients, setTemplateIngredients] = useState<MealIngredient[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [helperPrompt, setHelperPrompt] = useState("");
  const [mealPlanTitle, setMealPlanTitle] = useState("");
  const [mealPlanNote, setMealPlanNote] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedFood[]>([]);
  const [helperError, setHelperError] = useState("");
  const [helperTime, setHelperTime] = useState(nowTime);
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [finishTime, setFinishTime] = useState(nowTime);
  const [workoutPhoto, setWorkoutPhoto] = useState<Blob | null>(null);
  const [workoutPreview, setWorkoutPreview] = useState("");
  const [machineSuggestion, setMachineSuggestion] = useState("");
  const [workoutError, setWorkoutError] = useState("");
  const [workoutPhotoUrls, setWorkoutPhotoUrls] = useState<Record<string, string>>({});
  const [historyExercise, setHistoryExercise] = useState("");
  const identifyMachine = useIdentifyExerciseMachine();
  const readLabel = useReadLifeNutritionLabel();
  const createPlan = useCreateLifeMealPlan();

  const todayMeals = useMemo(() => data.meals.filter(meal => meal.date === todayKey()), [data.meals]);
  const totals = useMemo(() => todayMeals.reduce((total, meal) => ({
    calories: total.calories + meal.calories, protein: total.protein + meal.protein,
    carbs: total.carbs + meal.carbs, fat: total.fat + meal.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [todayMeals]);
  const remainingCalories = Math.max(0, data.settings.calorieTarget - totals.calories);
  const remainingProtein = Math.max(0, data.settings.proteinTarget - totals.protein);
  const nutritionTargets = [
    { name: "Calories", current: totals.calories, target: data.settings.calorieTarget, unit: "kcal", mode: "limit" as const },
    { name: "Protein", current: totals.protein, target: data.settings.proteinTarget, unit: "g", mode: "goal" as const },
    { name: "Carbs", current: totals.carbs, target: data.settings.carbsTarget, unit: "g", mode: "limit" as const },
    { name: "Fat", current: totals.fat, target: data.settings.fatTarget, unit: "g", mode: "limit" as const },
  ];

  useEffect(() => {
    let alive = true;
    for (const food of data.savedFoods) {
      if (food.photoKey && !foodPhotoUrls[food.photoKey]) {
        void loadMealPhoto(food.photoKey).then(blob => {
          if (alive && blob) setFoodPhotoUrls(prev => ({ ...prev, [food.photoKey!]: URL.createObjectURL(blob) }));
        }).catch(() => undefined);
      }
    }
    return () => { alive = false; };
  }, [data.savedFoods, foodPhotoUrls]);
  useEffect(() => {
    let alive = true;
    for (const workout of data.workouts) {
      if (workout.photoKey && !workoutPhotoUrls[workout.photoKey]) {
        void loadWorkoutImage(workout.photoKey).then(blob => {
          if (alive && blob) setWorkoutPhotoUrls(prev => ({ ...prev, [workout.photoKey!]: URL.createObjectURL(blob) }));
        }).catch(() => undefined);
      }
    }
    return () => { alive = false; };
  }, [data.workouts, workoutPhotoUrls]);
  useEffect(() => () => {
    Object.values(foodPhotoUrls).forEach(URL.revokeObjectURL);
    Object.values(workoutPhotoUrls).forEach(URL.revokeObjectURL);
    if (labelPreview) URL.revokeObjectURL(labelPreview);
    if (workoutPreview) URL.revokeObjectURL(workoutPreview);
  }, []);

  async function search(queryText: string): Promise<MacroFood[]> {
    const response = await searchLifeNutrition({ query: queryText.trim() });
    return response.map(item => ({ ...item }));
  }
  async function lookupFood(event?: FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 2) { setFoodError("Enter at least two characters to search."); return; }
    setSearching(true); setFoodError(""); setResults([]);
    try {
      const found = await search(query);
      setResults(found);
      if (!found.length) setFoodError("No matches found. You can enter values from a verified label or save a package label photo.");
    } catch { setFoodError("The food databases could not be reached. Try again, enter values from the packet, or use the package-photo reader."); }
    finally { setSearching(false); }
  }
  function createMeal(food: MacroFood | SavedFood, amount = Number(grams), time = mealTime, name = food.name, photoKey?: string) {
    if (!Number.isFinite(amount) || amount <= 0) { setFoodError("Enter a serving amount greater than zero grams."); return; }
    const macroFood = "calories" in food ? food : {
      calories: food.caloriesPer100, protein: food.proteinPer100, carbs: food.carbsPer100, fat: food.fatPer100,
    };
    const scaled = macros(macroFood, amount);
    const meal: Meal = { id: makeId(), name, grams: amount, ...scaled, time: time || nowTime(), date: todayKey(), source: food.source, ...(photoKey ? { photoKey } : {}) };
    update("meals", [meal, ...data.meals]);
    setFoodError(""); setResults([]); setQuery("");
  }
  function logManual() {
    const values = manualValues.map(Number), amount = Number(grams);
    if (!query.trim() || !Number.isFinite(amount) || amount <= 0 || values.some(v => !Number.isFinite(v) || v < 0)) {
      setFoodError("Add a food name, valid gram amount and non-negative macro values."); return;
    }
    update("meals", [{ id: makeId(), name: query.trim(), grams: amount, calories: values[0], protein: values[1], carbs: values[2], fat: values[3], time: mealTime || nowTime(), date: todayKey(), source: "Food label / manual" }, ...data.meals]);
    setFoodError(""); setQuery(""); setManual(false);
  }
  async function transcribeLabel(file?: File) {
    if (!file) return;
    setLabelError(""); setLabelDraft(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setLabelError("Choose a JPEG, PNG or WebP package photo."); return; }
    try {
      const image = await compressImage(file);
      setLabelPhoto(image);
      if (labelPreview) URL.revokeObjectURL(labelPreview);
      setLabelPreview(URL.createObjectURL(image));
      const result = await readLabel.mutateAsync({ data: { imageBase64: await toInputImage(image), mimeType: "image/jpeg", provider: data.settings.nutritionAiProvider } });
      setLabelDraft({ name: result.foodName, servingGrams: result.servingGrams, calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, labelNotes: result.labelNotes });
    } catch (error) {
      setLabelError(error instanceof Error ? error.message : "The label could not be read. Try a clearer photo.");
    }
  }
  async function saveLabelFood(event: FormEvent) {
    event.preventDefault();
    if (!labelDraft || !labelDraft.name.trim() || labelDraft.servingGrams <= 0 || [labelDraft.calories, labelDraft.protein, labelDraft.carbs, labelDraft.fat].some(n => !Number.isFinite(n) || n < 0)) {
      setLabelError("Check the product name, serving size and nutrition values."); return;
    }
    let photoKey: string | undefined;
    if (labelPhoto) {
      photoKey = makeId();
      try { await storeMealPhoto(photoKey, labelPhoto); }
      catch { setLabelError("The product photo could not be saved on this device."); return; }
    }
    const factor = 100 / labelDraft.servingGrams;
    const saved: SavedFood = {
      id: makeId(), name: labelDraft.name.trim(), source: "Package label",
      caloriesPer100: labelDraft.calories * factor, proteinPer100: labelDraft.protein * factor,
      carbsPer100: labelDraft.carbs * factor, fatPer100: labelDraft.fat * factor,
      ...(photoKey ? { photoKey } : {}), createdAt: new Date().toISOString(),
    };
    update("savedFoods", [saved, ...data.savedFoods]);
    if (photoKey && labelPhoto) setFoodPhotoUrls(prev => ({ ...prev, [photoKey!]: URL.createObjectURL(labelPhoto) }));
    setLabelDraft(null); setLabelPhoto(null); setLabelPreview(""); setLabelError("");
  }
  function setDayStatus(day: string, field: "gym" | "diet", value: DayCheckIn["gym"] | DayCheckIn["diet"]) {
    updateCheck(data, update, day, field, value);
  }
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const monthDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const selectedCheck = data.dayChecks.find(item => item.date === selectedDay);
  const monthChecks = data.dayChecks.filter(item => item.date.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`));
  const goodDays = monthChecks.filter(item => item.diet === "good").length;
  const offDays = monthChecks.filter(item => item.diet === "off").length;
  const gymAttended = monthChecks.filter(item => item.gym === "went").length;
  const gymMissed = monthChecks.filter(item => item.gym === "missed").length;

  async function addTemplateFood(food: MacroFood) {
    const portion = Number(templateGrams);
    if (!Number.isFinite(portion) || portion <= 0) return;
    setTemplateIngredients(current => [...current, { id: makeId(), name: food.name, source: food.source, grams: portion, caloriesPer100: food.calories, proteinPer100: food.protein, carbsPer100: food.carbs, fatPer100: food.fat }]);
    setTemplateSearch([]);
    setTemplateQuery("");
  }
  function addSavedTemplateFood(food: SavedFood) {
    const portion = Number(templateGrams);
    if (!Number.isFinite(portion) || portion <= 0) return;
    setTemplateIngredients(current => [...current, {
      id: makeId(),
      name: food.name,
      source: food.source,
      grams: portion,
      caloriesPer100: food.caloriesPer100,
      proteinPer100: food.proteinPer100,
      carbsPer100: food.carbsPer100,
      fatPer100: food.fatPer100,
    }]);
  }
  const templateTotals = templateIngredients.reduce((sum, ingredient) => ({
    calories: sum.calories + nutrientFactor(ingredient.caloriesPer100, ingredient.grams),
    protein: sum.protein + nutrientFactor(ingredient.proteinPer100, ingredient.grams),
    carbs: sum.carbs + nutrientFactor(ingredient.carbsPer100, ingredient.grams),
    fat: sum.fat + nutrientFactor(ingredient.fatPer100, ingredient.grams),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  function resetTemplate() { setTemplateName(""); setTemplateIngredients([]); setEditingTemplate(null); }
  function saveTemplate() {
    if (!templateName.trim() || !templateIngredients.length) return;
    const saved: SavedMeal = { id: editingTemplate ?? makeId(), name: templateName.trim(), ingredients: templateIngredients, createdAt: new Date().toISOString() };
    update("savedMeals", editingTemplate ? data.savedMeals.map(item => item.id === editingTemplate ? saved : item) : [saved, ...data.savedMeals]);
    resetTemplate();
  }
  function editTemplate(template: SavedMeal) {
    setEditingTemplate(template.id); setTemplateName(template.name); setTemplateIngredients(template.ingredients.map(ingredient => ({ ...ingredient })));
    document.getElementById("hd-template-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function logTemplate(template: SavedMeal) {
    const aggregate = template.ingredients.reduce((sum, ingredient) => ({
      grams: sum.grams + ingredient.grams,
      calories: sum.calories + nutrientFactor(ingredient.caloriesPer100, ingredient.grams),
      protein: sum.protein + nutrientFactor(ingredient.proteinPer100, ingredient.grams),
      carbs: sum.carbs + nutrientFactor(ingredient.carbsPer100, ingredient.grams),
      fat: sum.fat + nutrientFactor(ingredient.fatPer100, ingredient.grams),
    }), { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
    update("meals", [{ id: makeId(), name: template.name, grams: aggregate.grams, calories: Math.round(aggregate.calories), protein: round1(aggregate.protein), carbs: round1(aggregate.carbs), fat: round1(aggregate.fat), date: todayKey(), time: mealTime || nowTime(), source: `Meal template · ${template.ingredients.length} ingredients` }, ...data.meals]);
  }
  async function buildMealPlan(event: FormEvent) {
    event.preventDefault();
    setHelperError(""); setSuggestions([]);
    setMealPlanTitle(""); setMealPlanNote("");
    if (helperPrompt.trim().length < 2) { setHelperError("Add a couple of ingredients or preferences first."); return; }
    try {
      const plan = await createPlan.mutateAsync({ data: {
        ingredients: helperPrompt.trim(), remainingCalories, remainingProtein,
        ...(data.settings.carbsTarget > 0 ? { remainingCarbs: Math.max(0, data.settings.carbsTarget - totals.carbs) } : {}),
        ...(data.settings.fatTarget > 0 ? { remainingFat: Math.max(0, data.settings.fatTarget - totals.fat) } : {}),
        provider: data.settings.nutritionAiProvider,
        eatenToday: todayMeals.slice(0, 30).map(meal => ({ name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat })),
      } });
      setMealPlanTitle(plan.title);
      setMealPlanNote(plan.note);
      const initial: SuggestedFood[] = plan.ingredients.map(item => ({ food: item.food, grams: item.grams, reason: item.reason, matches: [], loading: true }));
      setSuggestions(initial);
      await Promise.all(initial.map(async (item, index) => {
        try {
          const matches = await search(item.food);
          setSuggestions(current => current.map((entry, i) => i === index ? { ...entry, matches, selected: undefined, loading: false, error: matches.length ? undefined : "No database match. Search and choose a verified food before logging." } : entry));
        } catch {
          setSuggestions(current => current.map((entry, i) => i === index ? { ...entry, loading: false, error: "Food lookup failed. Try verifying this item again." } : entry));
        }
      }));
    } catch (error) { setHelperError(error instanceof Error ? error.message : "Meal suggestions are unavailable. Try again."); }
  }
  async function verifySuggestion(index: number, term: string) {
    const current = suggestions[index];
    setSuggestions(prev => prev.map((entry, i) => i === index ? { ...entry, loading: true, error: undefined } : entry));
    try {
      const matches = await search(term);
      setSuggestions(prev => prev.map((entry, i) => i === index ? { ...entry, matches, selected: undefined, loading: false, error: matches.length ? undefined : "No exact database result. Try a simpler food name." } : entry));
    } catch {
      setSuggestions(prev => prev.map((entry, i) => i === index ? { ...entry, loading: false, error: "Food lookup failed. Try again." } : entry));
    }
  }
  function logPlan() {
    const chosen = suggestions.filter(item => item.selected);
    if (!chosen.length) return;
    const ingredients: MealIngredient[] = chosen.map(item => ({ id: makeId(), name: item.selected!.name, source: item.selected!.source, grams: item.grams, caloriesPer100: item.selected!.calories, proteinPer100: item.selected!.protein, carbsPer100: item.selected!.carbs, fatPer100: item.selected!.fat }));
    const sum = ingredients.reduce((total, item) => ({ grams: total.grams + item.grams, calories: total.calories + nutrientFactor(item.caloriesPer100, item.grams), protein: total.protein + nutrientFactor(item.proteinPer100, item.grams), carbs: total.carbs + nutrientFactor(item.carbsPer100, item.grams), fat: total.fat + nutrientFactor(item.fatPer100, item.grams) }), { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
    const name = mealPlanTitle.trim() || "Meal suggestion";
    update("meals", [{ id: makeId(), name, grams: sum.grams, calories: Math.round(sum.calories), protein: round1(sum.protein), carbs: round1(sum.carbs), fat: round1(sum.fat), date: todayKey(), time: helperTime || nowTime(), source: "Verified food database matches" }, ...data.meals]);
    setSuggestions([]); setHelperPrompt(""); setMealPlanTitle(""); setMealPlanNote("");
  }
  async function chooseWorkoutPhoto(file?: File) {
    if (!file) return;
    setWorkoutError(""); setMachineSuggestion("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setWorkoutError("Choose a JPEG, PNG or WebP image."); return; }
    try {
      const image = await compressImage(file);
      setWorkoutPhoto(image);
      if (workoutPreview) URL.revokeObjectURL(workoutPreview);
      setWorkoutPreview(URL.createObjectURL(image));
      const result = await identifyMachine.mutateAsync({ data: { imageBase64: await toInputImage(image), mimeType: "image/jpeg" } });
      setMachineSuggestion(result.suggestion);
      const guessed = result.suggestion.split(/[.\n]/)[0].replace(/^likely (an? )?/i, "").trim();
      if (guessed) setExercise(guessed);
    } catch (error) { setWorkoutError(error instanceof Error ? error.message : "This equipment photo could not be identified."); }
  }
  async function saveWorkout(event: FormEvent) {
    event.preventDefault();
    const w = Number(weight), r = Number(reps), s = Number(sets);
    if (!exercise.trim() || !Number.isFinite(w) || w < 0 || !Number.isInteger(r) || r < 1 || !Number.isInteger(s) || s < 1) { setWorkoutError("Add an exercise, non-negative weight, reps and sets."); return; }
    let photoKey: string | undefined;
    if (workoutPhoto) {
      photoKey = makeId();
      try { await storeWorkoutImage(photoKey, workoutPhoto); }
      catch { setWorkoutError("The equipment photo could not be saved on this device."); return; }
    }
    const entry: WorkoutEntry = { id: makeId(), exercise: exercise.trim(), weight: w, reps: r, sets: s, finishedAt: finishTime || nowTime(), date: todayKey(), ...(photoKey ? { photoKey } : {}) };
    update("workouts", [entry, ...data.workouts]);
    if (photoKey && workoutPhoto) setWorkoutPhotoUrls(prev => ({ ...prev, [photoKey!]: URL.createObjectURL(workoutPhoto) }));
    setWeight(""); setReps(""); setSets(""); setWorkoutPhoto(null); setWorkoutPreview(""); setMachineSuggestion(""); setWorkoutError("");
    setHistoryExercise(entry.exercise);
  }
  const historyNames = [...new Set(data.workouts.map(item => item.exercise))];
  const chosenHistoryName = historyExercise || historyNames[0] || "";
  const history = data.workouts.filter(item => item.exercise.toLowerCase() === chosenHistoryName.toLowerCase()).slice().sort((a, b) => a.date.localeCompare(b.date) || a.finishedAt.localeCompare(b.finishedAt)).slice(-10);
  const low = history.length ? Math.min(...history.map(item => item.weight)) : 0;
  const high = history.length ? Math.max(...history.map(item => item.weight)) : 1;
  const chartPoints = history.map((item, index) => {
    const x = history.length === 1 ? 50 : 6 + index * 88 / (history.length - 1);
    const y = 88 - ((item.weight - low) / Math.max(1, high - low)) * 66;
    return `${x},${y}`;
  }).join(" ");

  return <main className="health-dashboard">
    <header className="hd-header">
      <div><span className="hd-kicker">WELLBEING · FOOD & MOVEMENT</span><h1>Care for your energy.</h1><p>A quiet place to notice what supports you, one day at a time.</p></div>
      <div className="hd-streak-chip"><Flame size={15}/><span><b>{streakFor(data.dayChecks, "gym")}</b> day gym streak</span></div>
    </header>

    <Panel className="hd-calendar-panel">
      <div className="hd-calendar-top">
        <div><span className="hd-kicker">MONTHLY RHYTHM</span><h2>{fmtMonth(month)}</h2></div>
        <div className="hd-month-nav">
          <button type="button" aria-label="Previous month" onClick={() => { const next = new Date(month.getFullYear(), month.getMonth() - 1, 1); setMonth(next); setSelectedDay(dateKey(next)); }}><ChevronLeft size={18}/></button>
          <button type="button" aria-label="Next month" onClick={() => { const next = new Date(month.getFullYear(), month.getMonth() + 1, 1); setMonth(next); setSelectedDay(dateKey(next)); }}><ChevronRight size={18}/></button>
        </div>
      </div>
      <div className="hd-calendar-grid" role="grid" aria-label={`${fmtMonth(month)} check-ins`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div className="hd-weekday" role="columnheader" key={day}>{day}</div>)}
        {monthDays.map((day, index) => {
          if (!day) return <div className="hd-day-blank" key={`blank-${index}`} aria-hidden="true"/>;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const check = data.dayChecks.find(item => item.date === key);
          const today = key === todayKey();
          return <button type="button" role="gridcell" aria-label={`${key}${check?.gym ? `, gym ${check.gym}` : ""}${check?.diet ? `, diet ${check.diet}` : ""}`} aria-pressed={selectedDay === key} className={`hd-day ${selectedDay === key ? "is-selected" : ""} ${today ? "is-today" : ""}`} key={key} onClick={() => setSelectedDay(key)}>
            <span>{day}</span><i className={`hd-day-half hd-gym ${check?.gym ? `status-${check.gym}` : ""}`} aria-hidden="true"/><i className={`hd-day-half hd-diet ${check?.diet ? `status-${check.diet}` : ""}`} aria-hidden="true"/>
          </button>;
        })}
      </div>
      <div className="hd-calendar-foot">
        <div className="hd-legend"><span><i className="legend-gym"/>Gym</span><span><i className="legend-diet"/>Diet</span></div>
        <div className="hd-calendar-stats">
          <span><b>{goodDays}</b> good diet</span><span><b>{offDays}</b> off track</span><span><b>{gymAttended}</b> attended</span><span><b>{gymMissed}</b> missed</span>
        </div>
      </div>
      <div className="hd-selected-day">
        <div><span className="hd-kicker">CHECK IN</span><strong>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${selectedDay}T12:00:00`))}</strong></div>
        <div className="hd-status-controls">
          <fieldset><legend>Gym</legend>{(["went", "missed"] as const).map(status => <button type="button" key={status} aria-pressed={selectedCheck?.gym === status} className={`hd-status-button gym ${selectedCheck?.gym === status ? "active" : ""}`} onClick={() => setDayStatus(selectedDay, "gym", selectedCheck?.gym === status ? null : status)}>{status === "went" ? "Went" : "Missed"}</button>)}</fieldset>
          <fieldset><legend>Diet</legend>{(["good", "off"] as const).map(status => <button type="button" key={status} aria-pressed={selectedCheck?.diet === status} className={`hd-status-button diet ${selectedCheck?.diet === status ? "active" : ""}`} onClick={() => setDayStatus(selectedDay, "diet", selectedCheck?.diet === status ? null : status)}>{status === "good" ? "Good" : "Off track"}</button>)}</fieldset>
        </div>
        <span className="hd-streaks">Current streaks · {streakFor(data.dayChecks, "gym")} gym · {streakFor(data.dayChecks, "diet")} diet</span>
      </div>
    </Panel>

    <nav className="hd-tabs" aria-label="Health sections">
      <button type="button" className={tab === "food" ? "active" : ""} aria-current={tab === "food" ? "page" : undefined} onClick={() => setTab("food")}><Utensils size={16}/> Food & nutrition</button>
      <button type="button" className={tab === "training" ? "active" : ""} aria-current={tab === "training" ? "page" : undefined} onClick={() => setTab("training")}><Dumbbell size={16}/> Training</button>
    </nav>

    {tab === "food" ? <div className="hd-food-view">
      <div className="hd-food-main">
        <Panel className="hd-intake">
          <div className="hd-intake-heading"><div><span className="hd-kicker">TODAY · NUTRITION</span><strong>{Math.round(totals.calories).toLocaleString()} <small>kcal</small></strong><span>Daily intake compared with your saved targets</span></div><div className={`hd-intake-ring status-${targetStatus(totals.calories, data.settings.calorieTarget, "limit").state}`} style={{ "--amount": `${Math.min(100, totals.calories / Math.max(1, data.settings.calorieTarget) * 100)}%` } as React.CSSProperties}><Heart size={19}/></div></div>
          <div className="hd-target-grid">
            {nutritionTargets.map(metric => {
              const status = targetStatus(metric.current, metric.target, metric.mode);
              const percent = metric.target > 0 ? Math.min(100, metric.current / metric.target * 100) : 0;
              return <div className={`hd-target-metric status-${status.state}`} key={metric.name}>
                <div className="hd-target-label"><span>{metric.name}</span><small>{status.label}</small></div>
                <b>{Math.round(metric.current).toLocaleString()} <i>/ {metric.target > 0 ? `${metric.target.toLocaleString()} ${metric.unit}` : "set in Settings"}</i></b>
                <div className="hd-target-track" role="progressbar" aria-label={`${metric.name} target progress`} aria-valuemin={0} aria-valuemax={metric.target || 1} aria-valuenow={Math.min(metric.current, metric.target || 1)}><i style={{ width: `${percent}%` }}/></div>
              </div>;
            })}
          </div>
          <p className="hd-honesty-note">{todayMeals.length ? "Status compares logged food with your saved targets; meals you have not logged are not counted." : "No meals logged today, so I can’t assess your intake yet."} Search results are database estimates; check packet labels when precision matters.</p>
        </Panel>
        <Panel>
          <PanelHeading icon={<Plus size={16}/>} label="FOOD DATABASE" title="Log a meal"/>
          <p className="hd-copy">Search USDA FoodData Central first, then Open Food Facts. Values are per 100 g and scaled to your portion. Packaged-food data can be incomplete; a label photo is better for your exact product.</p>
          <form onSubmit={lookupFood}>
            <Field label="Food or product" value={query} onChange={setQuery} placeholder="Search food or brand" id="hd-food-search"/>
            <div className="hd-field-row"><Field label="Serving (g)" type="number" min="1" step="1" value={grams} onChange={setGrams} id="hd-food-grams"/><Field label="Meal time" type="time" value={mealTime} onChange={setMealTime} id="hd-food-time"/></div>
            <button className="hd-primary" type="submit" disabled={searching || query.trim().length < 2}>{searching ? <LoaderCircle size={16} className="hd-spin"/> : <Search size={16}/>}Search food data</button>
          </form>
          {foodError && <ErrorNote>{foodError}</ErrorNote>}
          {results.map(food => <div className="hd-result" key={food.id}><div><b>{food.name}</b><small>{food.source} · 100 g: {Math.round(food.calories)} kcal · P {food.protein} · C {food.carbs} · F {food.fat} g</small><small>At {grams || "0"} g: {macros(food, Number(grams) || 0).calories} kcal · P {macros(food, Number(grams) || 0).protein} · C {macros(food, Number(grams) || 0).carbs} · F {macros(food, Number(grams) || 0).fat} g</small></div><button className="hd-small-button" type="button" onClick={() => createMeal(food)}>Log</button></div>)}
          <button type="button" className="hd-text-button" onClick={() => { setManual(value => !value); setFoodError(""); }}>{manual ? "Close manual entry" : "Enter values from a food label"}</button>
          {manual && <div className="hd-manual"><span className="hd-kicker">FOR THIS PORTION · {grams || 0} G</span><div className="hd-field-row">{["Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)"].map((label, index) => <Field key={label} label={label} type="number" min="0" step=".1" value={manualValues[index]} onChange={value => setManualValues(old => old.map((entry, i) => i === index ? value : entry))}/>)}</div><button className="hd-primary" type="button" onClick={logManual}><Check size={15}/>Save meal</button></div>}
        </Panel>
        <Panel>
          <PanelHeading icon={<Camera size={16}/>} label="PACKAGE LABEL" title="Save a food from its label"/>
          <p className="hd-copy">Take or upload a clear photo. Review the transcription before saving it to this device.</p>
          <label className="hd-upload"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>) => { void transcribeLabel(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}/>{readLabel.isPending ? <LoaderCircle className="hd-spin" size={19}/> : <Camera size={19}/>}<span><b>{readLabel.isPending ? "Reading package…" : "Take or choose a photo"}</b><small>JPEG, PNG or WebP · stored on this device</small></span></label>
          {labelPreview && <img className="hd-label-preview" src={labelPreview} alt="Package label being reviewed"/>}
          {labelError && <ErrorNote>{labelError}</ErrorNote>}
          {labelDraft && <form className="hd-label-review" onSubmit={saveLabelFood}><div className="hd-review-title"><strong>Check the label values</strong><span>Transcribed values may need correction.</span></div>{labelDraft.labelNotes && <p className="hd-copy hd-label-notes">{labelDraft.labelNotes}</p>}<Field label="Product name" value={labelDraft.name} onChange={name => setLabelDraft({ ...labelDraft, name })}/><Field label="Serving size (g)" type="number" min=".1" step=".1" value={String(labelDraft.servingGrams)} onChange={value => setLabelDraft({ ...labelDraft, servingGrams: Number(value) })}/><div className="hd-field-row">{(["calories", "protein", "carbs", "fat"] as const).map(key => <Field key={key} label={`${key === "calories" ? "Calories (kcal)" : `${key[0].toUpperCase()}${key.slice(1)} (g)`}`} type="number" min="0" step=".1" value={String(labelDraft[key])} onChange={value => setLabelDraft({ ...labelDraft, [key]: Number(value) })}/>)}</div><p className="hd-copy">Values above are for {labelDraft.servingGrams} g. Saved-food macros are converted to per 100 g. Check the packet before saving.</p><button type="submit" className="hd-primary"><Check size={15}/>Save product and photo</button></form>}
        </Panel>
      </div>
      <aside className="hd-food-side">
        <Panel className="hd-today-meals">
          <PanelHeading icon={<Clock3 size={16}/>} label="TODAY’S LOG" title="Meals" aside={<span className="hd-count">{todayMeals.length}</span>}/>
          {todayMeals.length ? todayMeals.map(meal => <div className="hd-meal-row" key={meal.id}><time>{meal.time}</time><div><b>{meal.name}</b><small>{meal.grams} g · {meal.source}</small><small>P {macroText(meal.protein)} · C {macroText(meal.carbs)} · F {macroText(meal.fat)} g</small></div><strong>{Math.round(meal.calories)}<small> kcal</small></strong><button className="hd-icon-button" type="button" aria-label={`Remove ${meal.name}`} onClick={() => update("meals", data.meals.filter(item => item.id !== meal.id))}><Trash2 size={15}/></button></div>) : <Empty title="A clear start" text="Your food log will build here as you add meals."/>}
        </Panel>
        <Panel>
          <PanelHeading icon={<FileText size={16}/>} label="ON THIS DEVICE" title="Saved foods" aside={<span className="hd-count">{data.savedFoods.length}</span>}/>
          {data.savedFoods.length ? data.savedFoods.map(food => <div className="hd-saved-food" key={food.id}>{food.photoKey && foodPhotoUrls[food.photoKey] ? <img src={foodPhotoUrls[food.photoKey]} alt={`${food.name} package`}/> : <span className="hd-food-placeholder"><Utensils size={15}/></span>}<div><b>{food.name}</b><small>{food.source} · per 100 g · {Math.round(food.caloriesPer100)} kcal</small></div><button className="hd-small-button" type="button" onClick={() => createMeal(food, Number(grams), mealTime)}>Log</button></div>) : <Empty title="No saved products yet" text="Transcribe and confirm a package label to keep a reusable entry."/>}
        </Panel>
      </aside>

      <Panel className="hd-template-panel" id="hd-template-builder">
        <PanelHeading icon={<Utensils size={16}/>} label="REPEATABLE MEALS" title="Meal templates"/>
        <p className="hd-copy">Build a recipe from database foods, adjust portions, then save it for next time.</p>
        <div className="hd-template-grid">
          <div className="hd-template-builder">
            <Field label="Template name" value={templateName} onChange={setTemplateName} placeholder="e.g. Post-workout bowl"/>
            <div className="hd-template-search"><Field label="Find an ingredient" value={templateQuery} onChange={setTemplateQuery} placeholder="Search USDA or food brands"/><div className="hd-field-row"><Field label="Portion (g)" value={templateGrams} onChange={setTemplateGrams} type="number" min="1"/></div><button type="button" className="hd-secondary" disabled={templateQuery.trim().length < 2} onClick={async () => { try { setTemplateSearch(await search(templateQuery)); } catch { setFoodError("The food databases could not be reached. Try again or use a saved product or package photo."); } }}><Search size={15}/>Find ingredient</button></div>
            {templateSearch.map(food => <div className="hd-result" key={food.id}><div><b>{food.name}</b><small>{food.source} · {Math.round(food.calories)} kcal per 100 g</small></div><button className="hd-small-button" type="button" onClick={() => void addTemplateFood(food)}>Add</button></div>)}
             {data.savedFoods.length > 0 && <div className="hd-saved-ingredients"><span className="hd-kicker">SAVED PRODUCTS</span>{data.savedFoods.map(food => <div className="hd-result" key={food.id}><div><b>{food.name}</b><small>{food.source} · {Math.round(food.caloriesPer100)} kcal per 100 g</small></div><button className="hd-small-button" type="button" onClick={() => addSavedTemplateFood(food)}>Add</button></div>)}</div>}
            {templateIngredients.length > 0 && <div className="hd-ingredient-list">{templateIngredients.map(item => <div className="hd-ingredient" key={item.id}><div><b>{item.name}</b><small>{item.source}</small></div><label><span className="sr-only">Grams of {item.name}</span><input aria-label={`Grams of ${item.name}`} type="number" min="1" value={item.grams} onChange={event => setTemplateIngredients(current => current.map(entry => entry.id === item.id ? { ...entry, grams: Number(event.target.value) } : entry))}/><span>g</span></label><button className="hd-icon-button" type="button" aria-label={`Remove ${item.name}`} onClick={() => setTemplateIngredients(current => current.filter(entry => entry.id !== item.id))}><X size={15}/></button></div>)}</div>}
            <div className="hd-template-total"><b>Recipe total</b><span>{Math.round(templateTotals.calories)} kcal</span><span>P {round1(templateTotals.protein)}g</span><span>C {round1(templateTotals.carbs)}g</span><span>F {round1(templateTotals.fat)}g</span></div>
            <div className="hd-action-row"><button className="hd-primary" type="button" disabled={!templateName.trim() || !templateIngredients.length} onClick={saveTemplate}><Check size={15}/>{editingTemplate ? "Update template" : "Save template"}</button>{editingTemplate && <button className="hd-secondary" type="button" onClick={resetTemplate}>Cancel edit</button>}</div>
          </div>
          <div className="hd-template-saved"><span className="hd-kicker">SAVED RECIPES · {data.savedMeals.length}</span>{data.savedMeals.length ? data.savedMeals.map(template => {
            const calc = template.ingredients.reduce((sum, ingredient) => ({ grams: sum.grams + ingredient.grams, calories: sum.calories + nutrientFactor(ingredient.caloriesPer100, ingredient.grams), protein: sum.protein + nutrientFactor(ingredient.proteinPer100, ingredient.grams), carbs: sum.carbs + nutrientFactor(ingredient.carbsPer100, ingredient.grams), fat: sum.fat + nutrientFactor(ingredient.fatPer100, ingredient.grams) }), { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
            return <article className="hd-template-card" key={template.id}><div className="hd-template-card-head"><div><b>{template.name}</b><small>{template.ingredients.length} ingredients · {Math.round(calc.grams)} g</small></div><button type="button" className="hd-icon-button" aria-label={`Delete ${template.name}`} onClick={() => { update("savedMeals", data.savedMeals.filter(item => item.id !== template.id)); if (editingTemplate === template.id) resetTemplate(); }}><Trash2 size={15}/></button></div><p>{Math.round(calc.calories)} kcal · P {round1(calc.protein)} · C {round1(calc.carbs)} · F {round1(calc.fat)} g</p><div className="hd-action-row"><button className="hd-secondary" type="button" onClick={() => editTemplate(template)}>Edit</button><button className="hd-primary" type="button" onClick={() => logTemplate(template)}><Plus size={14}/>Log meal</button></div></article>;
          }) : <Empty title="Start a recipe" text="Your saved combinations will appear here."/>}</div>
        </div>
      </Panel>

      <Panel className="hd-helper-panel">
        <PanelHeading icon={<Sparkles size={16}/>} label="MEAL HELPER" title="Use what you have"/>
        <p className="hd-copy">Suggestions account for your remaining target and today’s log. Every food is checked against a nutrition database before you can add it; suggested portions are a starting point, not exact macros.</p>
        <form className="hd-helper-form" onSubmit={buildMealPlan}><Field label="Ingredients or preferences" value={helperPrompt} onChange={setHelperPrompt} placeholder="What’s in your kitchen? Any preferences?"/><Field label="Meal time" value={helperTime} onChange={setHelperTime} type="time"/><div className="hd-remaining">Remaining today <b>{Math.round(remainingCalories)} kcal</b><b>{Math.round(remainingProtein)} g protein</b>{data.settings.carbsTarget > 0 && <b>{Math.round(Math.max(0, data.settings.carbsTarget - totals.carbs))} g carbs</b>}{data.settings.fatTarget > 0 && <b>{Math.round(Math.max(0, data.settings.fatTarget - totals.fat))} g fat</b>}</div><button className="hd-primary" disabled={createPlan.isPending || helperPrompt.trim().length < 2} type="submit">{createPlan.isPending ? <LoaderCircle size={16} className="hd-spin"/> : <Sparkles size={16}/>}Suggest a meal</button></form>
        {helperError && <ErrorNote>{helperError}</ErrorNote>}
         {suggestions.length > 0 && <div className="hd-suggestions"><div className="hd-suggestion-heading"><b>{mealPlanTitle || "Verify each ingredient"}</b><span>{mealPlanNote || "Choose the closest database match."}</span></div>{suggestions.map((item, index) => <div className="hd-suggestion" key={`${index}-${item.food}`}><div className="hd-suggestion-name"><b>{item.food}</b><span>{item.grams} g suggested · {item.reason}</span></div><div className="hd-verify-row"><input aria-label={`Search match for ${item.food}`} defaultValue={item.food} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void verifySuggestion(index, event.currentTarget.value); } }}/><button className="hd-secondary" type="button" disabled={item.loading} onClick={event => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; void verifySuggestion(index, input.value); }}>{item.loading ? <LoaderCircle size={14} className="hd-spin"/> : <Search size={14}/>}Verify</button></div>{item.error && <ErrorNote>{item.error}</ErrorNote>}{item.matches.length > 0 && <label className="hd-select-match"><span>Database match</span><select value={item.selected?.id ?? ""} onChange={event => setSuggestions(current => current.map((entry, i) => i === index ? { ...entry, selected: entry.matches.find(match => match.id === event.target.value) } : entry))}><option value="">Choose a food to confirm</option>{item.matches.map(match => <option value={match.id} key={match.id}>{match.name} · {match.source}</option>)}</select></label>}{item.selected && <small className="hd-verified-macros">At {item.grams} g: {macros(item.selected, item.grams).calories} kcal · P {macros(item.selected, item.grams).protein} · C {macros(item.selected, item.grams).carbs} · F {macros(item.selected, item.grams).fat} g</small>}</div>)}<div className="hd-action-row"><button className="hd-primary" type="button" disabled={!suggestions.some(item => item.selected)} onClick={logPlan}><Check size={15}/>Log verified items</button><button className="hd-secondary" type="button" onClick={() => setSuggestions([])}>Dismiss</button></div></div>}
      </Panel>
    </div> : <div className="hd-training-view">
      <Panel className="hd-workout-form">
        <PanelHeading icon={<Dumbbell size={16}/>} label="STRENGTH NOTES" title="Log a workout"/>
        <p className="hd-copy">Save a set, track load over time, and keep the equipment note if it helps.</p>
        <form onSubmit={saveWorkout}>
          <label className="hd-upload"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => { void chooseWorkoutPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}/>{identifyMachine.isPending ? <LoaderCircle size={19} className="hd-spin"/> : <Camera size={19}/>}<span><b>{identifyMachine.isPending ? "Reading equipment…" : "Identify equipment from a photo"}</b><small>Optional · JPEG, PNG or WebP</small></span></label>
          {workoutPreview && <img className="hd-workout-preview" src={workoutPreview} alt="Selected equipment"/>}
          {machineSuggestion && <div className="hd-machine-note"><span className="hd-kicker">MACHINE SUGGESTION</span><p>{machineSuggestion}</p></div>}
          <Field label="Exercise or machine" value={exercise} onChange={setExercise} placeholder="e.g. Seated row"/>
          <div className="hd-field-row hd-workout-fields"><Field label="Weight (kg)" value={weight} onChange={setWeight} type="number" min="0" step=".1"/><Field label="Reps" value={reps} onChange={setReps} type="number" min="1" step="1"/><Field label="Sets" value={sets} onChange={setSets} type="number" min="1" step="1"/></div>
          <Field label="Finished at" value={finishTime} onChange={setFinishTime} type="time"/>
          {workoutError && <ErrorNote>{workoutError}</ErrorNote>}
          <button className="hd-primary" type="submit" disabled={!exercise.trim() || !weight || !reps || !sets}><Check size={16}/>Save workout</button>
        </form>
      </Panel>
      <div className="hd-training-records">
        <Panel>
          <PanelHeading icon={<TrendingUp size={16}/>} label="WEIGHT LIFTED" title="Progress history"/>
          <label className="hd-field"><span>Choose an exercise</span><select value={chosenHistoryName} onChange={event => setHistoryExercise(event.target.value)}><option value="">Select an exercise</option>{historyNames.map(name => <option key={name}>{name}</option>)}</select></label>
          {history.length ? <><h3 className="hd-chart-title">{chosenHistoryName}</h3><div className="hd-chart-wrap"><svg className="hd-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Weight history for ${chosenHistoryName}: ${history.map(item => `${item.weight} kilograms`).join(", ")}`}><line x1="5" y1="88" x2="95" y2="88" className="hd-chart-axis"/><polyline points={chartPoints} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>{history.map((item, index) => { const x = history.length === 1 ? 50 : 6 + index * 88 / (history.length - 1); const y = 88 - ((item.weight - low) / Math.max(1, high - low)) * 66; return <circle key={item.id} cx={x} cy={y} r="2.2" className="hd-chart-dot"><title>{item.date} · {item.weight} kg</title></circle>; })}</svg></div><div className="hd-chart-caption"><span>{history.length} recent sessions</span><span>{low === high ? `${high} kg` : `${low}–${high} kg`}</span></div><p className="hd-trend-feedback">{formatTrend(history)}</p>{history.slice().reverse().map(item => <div className="hd-workout-row" key={item.id}><div><b>{item.weight} kg <span>·</span> {item.sets} × {item.reps}</b><small>{item.date} · finished {item.finishedAt}</small></div><button className="hd-icon-button" type="button" aria-label={`Remove ${item.exercise} workout on ${item.date}`} onClick={() => update("workouts", data.workouts.filter(entry => entry.id !== item.id))}><Trash2 size={15}/></button></div>)}</> : <Empty title="Progress grows with each log" text="Use the same exercise name each time to see a useful weight trend."/>}
        </Panel>
        {data.workouts.some(item => item.photoKey) && <Panel><PanelHeading icon={<Camera size={16}/>} title="Equipment notes"/><div className="hd-equipment-gallery">{data.workouts.filter(item => item.photoKey).map(item => <figure key={item.id}>{workoutPhotoUrls[item.photoKey!] ? <img src={workoutPhotoUrls[item.photoKey!]} alt={`${item.exercise} equipment`}/> : <span><Camera size={17}/></span>}<figcaption>{item.exercise}<small>{item.date}</small></figcaption></figure>)}</div></Panel>}
      </div>
    </div>}
  </main>;
}

export default HealthDashboard;
