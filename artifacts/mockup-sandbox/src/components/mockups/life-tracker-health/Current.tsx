import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Check,
  Dumbbell,
  FileText,
  Heart,
  LoaderCircle,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";

import "./_group.css";

type Meal = {
  id: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  date: string;
  source: string;
};

type WorkoutEntry = {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  finishedAt: string;
  date: string;
  photoKey?: string;
};

type Settings = { calorieTarget: number; proteinTarget: number };
type LifeData = { meals: Meal[]; workouts: WorkoutEntry[]; settings: Settings };
type Food = {
  id: string;
  name: string;
  source: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const timeNow = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateKey(date);
};

const initialData = (): LifeData => ({
  settings: { calorieTarget: 2000, proteinTarget: 120 },
  meals: [
    {
      id: "sample-oats",
      name: "Rolled oats with blueberries",
      grams: 100,
      calories: 389,
      protein: 13.2,
      carbs: 66.3,
      fat: 6.9,
      time: "08:10",
      date: dateKey(),
      source: "USDA FoodData Central",
    },
    {
      id: "sample-lunch",
      name: "Chicken breast & brown rice",
      grams: 250,
      calories: 468,
      protein: 43.5,
      carbs: 52.1,
      fat: 8.2,
      time: "12:35",
      date: dateKey(),
      source: "Food label / manual",
    },
    {
      id: "sample-yogurt",
      name: "Plain Greek yogurt",
      grams: 170,
      calories: 150,
      protein: 17,
      carbs: 8,
      fat: 4,
      time: "15:20",
      date: dateKey(),
      source: "USDA FoodData Central",
    },
  ],
  workouts: [
    { id: "sample-row-1", exercise: "Seated row", weight: 32.5, reps: 10, sets: 3, finishedAt: "18:05", date: dateOffset(21) },
    { id: "sample-row-2", exercise: "Seated row", weight: 35, reps: 10, sets: 3, finishedAt: "18:12", date: dateOffset(14) },
    { id: "sample-row-3", exercise: "Seated row", weight: 37.5, reps: 10, sets: 3, finishedAt: "18:24", date: dateOffset(7) },
    { id: "sample-row-4", exercise: "Seated row", weight: 40, reps: 8, sets: 3, finishedAt: "18:16", date: dateOffset(2) },
  ],
});

const sampleFoods: Food[] = [
  { id: "food-oats", name: "Oats, regular and quick, not fortified, dry", source: "USDA FoodData Central", calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 },
  { id: "food-banana", name: "Bananas, raw", source: "USDA FoodData Central", calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  { id: "food-yogurt", name: "Greek yogurt, plain, nonfat", source: "USDA FoodData Central", calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4 },
  { id: "food-chicken", name: "Chicken breast, boneless, skinless", source: "USDA FoodData Central", calories: 120, protein: 22.5, carbs: 0, fat: 2.6 },
  { id: "food-granola", name: "Granola, honey oat · Nature Valley", source: "Open Food Facts", calories: 471, protein: 10, carbs: 64, fat: 20 },
];

// Local sample-backed replacements for the food lookup and IndexedDB image storage.
async function searchFood(query: string): Promise<Food[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return sampleFoods.filter((food) => terms.some((term) => food.name.toLowerCase().includes(term)));
}

function IconButton({
  children,
  onClick,
  label,
  testId,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  testId: string;
  className?: string;
}) {
  return (
    <button aria-label={label} title={label} data-testid={testId} onClick={onClick} className={`icon-button ${className}`}>
      {children}
    </button>
  );
}

function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className={`button${secondary ? " button-secondary" : ""}`}>
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  testId,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  testId: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input data-testid={testId} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function PanelTitle({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <div className="panel-title">
      <h2>{children}</h2>
      {detail && <span>{detail}</span>}
    </div>
  );
}

function Empty({
  title,
  detail,
  icon: Icon = FileText,
}: {
  title: string;
  detail: string;
  icon?: typeof FileText;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={19} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function TopHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <header className="page-heading animate-in">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="serif">{title}</h1>
      <p className="subheading">{subtitle}</p>
    </header>
  );
}

export function Current() {
  const [data, setData] = useState<LifeData>(initialData);
  const update = <K extends keyof LifeData>(key: K, value: LifeData[K]) =>
    setData((previous) => ({ ...previous, [key]: value }));
  const [tab, setTab] = useState<"food" | "training">("food");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [foodError, setFoodError] = useState("");
  const [grams, setGrams] = useState("100");
  const [mealTime, setMealTime] = useState(timeNow);
  const [manual, setManual] = useState(false);
  const [manualValues, setManualValues] = useState(["", "", "", ""]);
  const [exercise, setExercise] = useState("Seated row");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [finishTime, setFinishTime] = useState(timeNow);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [exerciseError, setExerciseError] = useState("");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [identifying, setIdentifying] = useState(false);
  const imageStore = useRef(new Map<string, Blob>());

  const today = data.meals.filter((meal) => meal.date === dateKey());
  const calories = today.reduce((sum, meal) => sum + meal.calories, 0);
  const protein = today.reduce((sum, meal) => sum + meal.protein, 0);
  const carbs = today.reduce((sum, meal) => sum + meal.carbs, 0);
  const fats = today.reduce((sum, meal) => sum + meal.fat, 0);

  useEffect(() => {
    let alive = true;
    data.workouts.filter((workout) => workout.photoKey).forEach((workout) => {
      const key = workout.photoKey;
      if (key && !photoUrls[key]) {
        const blob = imageStore.current.get(key);
        if (blob && alive) setPhotoUrls((previous) => ({ ...previous, [key]: URL.createObjectURL(blob) }));
      }
    });
    return () => {
      alive = false;
    };
  }, [data.workouts, photoUrls]);

  const lookup = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setFoodError("");
    setResults([]);
    try {
      const found = await searchFood(query.trim());
      setResults(found);
      if (!found.length) setFoodError("No matches found. You can enter the nutrition from a verified label.");
    } catch {
      setFoodError("Nutrition search is unavailable. Try again or enter the label values.");
    } finally {
      setSearching(false);
    }
  };

  const logFood = (food: Food) => {
    const amount = Number(grams);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFoodError("Enter a valid portion in grams first.");
      return;
    }
    const factor = amount / 100;
    update("meals", [
      {
        id: makeId(),
        name: food.name,
        grams: amount,
        calories: Math.round(food.calories * factor),
        protein: Math.round(food.protein * factor * 10) / 10,
        carbs: Math.round(food.carbs * factor * 10) / 10,
        fat: Math.round(food.fat * factor * 10) / 10,
        time: mealTime || "12:00",
        date: dateKey(),
        source: food.source,
      },
      ...data.meals,
    ]);
    setResults([]);
    setQuery("");
  };

  const logManual = () => {
    const values = manualValues.map(Number);
    const amount = Number(grams);
    if (!query.trim() || !Number.isFinite(amount) || amount <= 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
      setFoodError("Enter a food name, portion and valid macro values.");
      return;
    }
    update("meals", [
      {
        id: makeId(),
        name: query.trim(),
        grams: amount,
        calories: values[0],
        protein: values[1],
        carbs: values[2],
        fat: values[3],
        time: mealTime || "12:00",
        date: dateKey(),
        source: "Food label / manual",
      },
      ...data.meals,
    ]);
    setQuery("");
    setManual(false);
  };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    setExerciseError("");
    setSuggestion("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setExerciseError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    setPhotoBlob(file);
    setPhotoPreview(URL.createObjectURL(file));
    setIdentifying(true);
    try {
      // The image-identification API is stubbed with a local, representative response.
      await Promise.resolve();
      const mockSuggestion = "Likely a cable or seated row machine. Try a controlled pull with your shoulders relaxed.";
      setSuggestion(mockSuggestion);
      const name = mockSuggestion.split(/[.\n]/)[0].replace(/^likely (an? )?/i, "").trim();
      if (name) setExercise(name);
    } catch (error) {
      setExerciseError(error instanceof Error ? error.message : "Could not identify this equipment.");
    } finally {
      setIdentifying(false);
    }
  };

  const saveWorkout = async () => {
    const parsedWeight = Number(weight);
    const parsedReps = Number(reps);
    const parsedSets = Number(sets);
    if (!exercise.trim() || !Number.isFinite(parsedWeight) || parsedWeight < 0 || !Number.isInteger(parsedReps) || parsedReps < 1 || !Number.isInteger(parsedSets) || parsedSets < 1) {
      setExerciseError("Add an exercise name, weight, reps and sets.");
      return;
    }
    let photoKey: string | undefined;
    if (photoBlob) {
      // IndexedDB is replaced by an in-memory image store in this isolated preview.
      photoKey = makeId();
      imageStore.current.set(photoKey, photoBlob);
    }
    const record: WorkoutEntry = {
      id: makeId(),
      exercise: exercise.trim(),
      weight: parsedWeight,
      reps: parsedReps,
      sets: parsedSets,
      finishedAt: finishTime,
      date: dateKey(),
      photoKey,
    };
    update("workouts", [record, ...data.workouts]);
    if (photoKey && photoPreview) setPhotoUrls((previous) => ({ ...previous, [photoKey!]: photoPreview }));
    setWeight("");
    setReps("");
    setSets("");
    setPhotoBlob(null);
    setPhotoPreview("");
    setSuggestion("");
    setExerciseError("");
  };

  const exerciseHistory = useMemo(
    () => data.workouts
      .filter((workout) => workout.exercise.toLowerCase() === exercise.trim().toLowerCase())
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8),
    [data.workouts, exercise],
  );
  const graphValues = exerciseHistory.map((workout) => workout.weight);
  const graphMin = Math.min(...graphValues);
  const graphMax = Math.max(...graphValues);
  const points = graphValues
    .map((value, index) => `${graphValues.length === 1 ? 160 : 12 + index / (graphValues.length - 1) * 296},${96 - ((value - graphMin) / Math.max(1, graphMax - graphMin)) * 72}`)
    .join(" ");

  return (
    <main className="health-preview">
      <div className="content-wrap">
        <TopHeading
          eyebrow="Nutrition & training"
          title="Care for your energy."
          subtitle="Small, steady records of what fuels you and how you grow stronger."
        />
        <div className="health-switch">
          <button className={tab === "food" ? "selected" : ""} onClick={() => setTab("food")} data-testid="health-tab-food">
            <Heart size={16} />Food & macros
          </button>
          <button className={tab === "training" ? "selected" : ""} onClick={() => setTab("training")} data-testid="health-tab-training">
            <Dumbbell size={16} />Training
          </button>
        </div>
        {tab === "food" ? (
          <div className="health-layout">
            <div className="health-left">
              <Panel className="nutrition-card">
                <div className="nutrition-top">
                  <div>
                    <span className="eyebrow">TODAY · NUTRITION</span>
                    <div className="calorie-number" data-testid="daily-calories">
                      {Math.round(calories).toLocaleString()}<small> kcal</small>
                    </div>
                    <p>of {data.settings.calorieTarget.toLocaleString()} kcal target</p>
                  </div>
                  <div
                    className="macro-donut"
                    style={{ "--progress": `${Math.min(100, calories / Math.max(1, data.settings.calorieTarget) * 100)}%` } as CSSProperties}
                  >
                    <span><Heart size={17} /></span>
                  </div>
                </div>
                <div className="nutrition-track">
                  <i style={{ width: `${Math.min(100, calories / Math.max(1, data.settings.calorieTarget) * 100)}%` }} />
                </div>
                <div className="nutrition-macros">
                  <div><small>PROTEIN</small><b>{Math.round(protein)} <i>/ {data.settings.proteinTarget}g</i></b></div>
                  <div><small>CARBS</small><b>{Math.round(carbs)} <i>g</i></b></div>
                  <div><small>FAT</small><b>{Math.round(fats)} <i>g</i></b></div>
                </div>
              </Panel>
              <Panel>
                <PanelTitle>Log a meal</PanelTitle>
                <p className="panel-copy">Search USDA for everyday foods or Open Food Facts for branded products. Values are scaled to your portion.</p>
                <Field label="Food or product" value={query} onChange={setQuery} placeholder="Try “oats” or a packaged product" testId="food-search" />
                <div className="form-split">
                  <Field label="Portion (g)" value={grams} onChange={setGrams} type="number" testId="food-grams" />
                  <Field label="Meal time" value={mealTime} onChange={setMealTime} type="time" testId="food-time" />
                </div>
                <Button testId="search-food" onClick={() => void lookup()} disabled={!query.trim() || searching}>
                  {searching ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Search food data
                </Button>
                {foodError && <p className="form-error" data-testid="food-error">{foodError}</p>}
                {results.map((food) => (
                  <div className="food-result" key={food.id}>
                    <div>
                      <b>{food.name}</b>
                      <small>{food.source} · per 100g · {Math.round(food.calories)} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g</small>
                    </div>
                    <Button secondary testId={`log-food-${food.id}`} onClick={() => logFood(food)}>Log</Button>
                  </div>
                ))}
                <button className="plain-link" data-testid="manual-food-toggle" onClick={() => setManual((value) => !value)}>
                  {manual ? "Close manual entry" : "Enter macros from food label"}
                </button>
                {manual && (
                  <div className="manual-entry">
                    <p>Enter macros for the selected portion ({grams || 0} g).</p>
                    <div className="form-split">
                      {["Calories (kcal)", "Protein (g)"].map((label, index) => (
                        <Field key={label} label={label} value={manualValues[index]} onChange={(value) => setManualValues((previous) => previous.map((item, i) => index === i ? value : item))} type="number" testId={`manual-${index}`} />
                      ))}
                    </div>
                    <div className="form-split">
                      {["Carbs (g)", "Fat (g)"].map((label, index) => (
                        <Field key={label} label={label} value={manualValues[index + 2]} onChange={(value) => setManualValues((previous) => previous.map((item, i) => index + 2 === i ? value : item))} type="number" testId={`manual-${index + 2}`} />
                      ))}
                    </div>
                    <Button testId="save-manual-meal" onClick={logManual}><Check size={15} />Save meal</Button>
                  </div>
                )}
              </Panel>
            </div>
            <Panel className="meals-card">
              <PanelTitle detail={`${today.length} LOGGED`}>Today’s meals</PanelTitle>
              {today.length ? today.map((meal) => (
                <div className="meal-entry" key={meal.id}>
                  <div className="meal-time">{meal.time}</div>
                  <div className="meal-description">
                    <b>{meal.name}</b>
                    <small>{meal.grams} g · {meal.source}</small>
                    <span>P {meal.protein} · C {meal.carbs} · F {meal.fat} g</span>
                  </div>
                  <strong>{Math.round(meal.calories)}<small> kcal</small></strong>
                  <IconButton label={`Remove ${meal.name}`} testId={`remove-meal-${meal.id}`} onClick={() => update("meals", data.meals.filter((item) => item.id !== meal.id))}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              )) : (
                <Empty title="A clear start to the day" detail="Search for something you ate, or enter values from a food label." icon={Heart} />
              )}
            </Panel>
          </div>
        ) : (
          <div className="training-layout">
            <Panel className="training-form">
              <div className="training-intro">
                <div className="round-icon"><Dumbbell size={19} /></div>
                <span className="eyebrow">STRENGTH NOTES</span>
                <h2 className="serif">Log your workout</h2>
                <p>Record a set, and give your progress somewhere to go.</p>
              </div>
              <label className="photo-drop" data-testid="equipment-photo-drop">
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void choosePhoto(event.currentTarget.files?.[0])} />
                <span className="photo-icon">{identifying ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}</span>
                <b>{identifying ? "Reading equipment…" : "Identify equipment from a photo"}</b>
                <small>Optional · JPEG, PNG or WebP</small>
              </label>
              {photoPreview && <img className="machine-preview" src={photoPreview} alt="Selected exercise equipment" />}
              {suggestion && (
                <div className="suggestion-box" data-testid="exercise-suggestion">
                  <span className="eyebrow">SUGGESTION</span>
                  <p>{suggestion}</p>
                </div>
              )}
              <Field label="Exercise or machine" value={exercise} onChange={setExercise} placeholder="e.g. Seated row" testId="exercise-name" />
              <div className="form-triple">
                <Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="0" type="number" testId="workout-weight" />
                <Field label="Reps" value={reps} onChange={setReps} placeholder="0" type="number" testId="workout-reps" />
                <Field label="Sets" value={sets} onChange={setSets} placeholder="0" type="number" testId="workout-sets" />
              </div>
              <Field label="Finished at" value={finishTime} onChange={setFinishTime} type="time" testId="workout-time" />
              {exerciseError && <p className="form-error" data-testid="workout-error">{exerciseError}</p>}
              <Button testId="save-workout" onClick={() => void saveWorkout()} disabled={!exercise.trim() || !weight || !reps || !sets}>
                <Check size={16} />Save workout
              </Button>
            </Panel>
            <div className="training-records">
              <Panel>
                <PanelTitle detail="WEIGHT LIFTED">Progress history</PanelTitle>
                <label className="field">
                  <span>Choose an exercise to view</span>
                  <select data-testid="exercise-history-select" value={exercise} onChange={(event) => setExercise(event.target.value)}>
                    <option value="">Select or type an exercise</option>
                    {[...new Set(data.workouts.map((workout) => workout.exercise))].map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
                {exerciseHistory.length ? (
                  <>
                    <h3 className="chart-title">{exerciseHistory[exerciseHistory.length - 1].exercise}</h3>
                    <svg className="progress-chart" viewBox="0 0 320 110" preserveAspectRatio="none" aria-label="Workout weight progress chart">
                      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {graphValues.map((value, index) => (
                        <circle
                          key={`${index}-${value}`}
                          cx={graphValues.length === 1 ? 160 : 12 + index / (graphValues.length - 1) * 296}
                          cy={96 - ((value - graphMin) / Math.max(1, graphMax - graphMin)) * 72}
                          r="4"
                          fill="hsl(var(--card))"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                    <div className="chart-caption">
                      <span>{exerciseHistory.length} recent sessions</span>
                      <span>{graphMin === graphMax ? `${graphMax} kg` : `${graphMin}–${graphMax} kg`}</span>
                    </div>
                    {exerciseHistory.slice().reverse().map((workout) => (
                      <div className="workout-row" key={workout.id}>
                        <div>
                          <b>{workout.weight} kg <span>·</span> {workout.sets} × {workout.reps}</b>
                          <small>{workout.date} · finished {workout.finishedAt}</small>
                        </div>
                        <IconButton label="Delete workout" testId={`remove-workout-${workout.id}`} onClick={() => update("workouts", data.workouts.filter((item) => item.id !== workout.id))}>
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    ))}
                  </>
                ) : (
                  <Empty title="Progress appears with each log" detail="Use the same exercise name each time to build a weight history." icon={TrendingUp} />
                )}
              </Panel>
              {data.workouts.some((workout) => workout.photoKey) && (
                <Panel>
                  <PanelTitle>Equipment photos</PanelTitle>
                  <div className="equipment-gallery">
                    {data.workouts.filter((workout) => workout.photoKey).map((workout) => (
                      <div key={workout.id}>
                        {workout.photoKey && photoUrls[workout.photoKey] && <img src={photoUrls[workout.photoKey]} alt={`${workout.exercise} equipment`} />}
                        <small>{workout.exercise}</small>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )}
        <footer className="footer-note"><span>YOUR LIFE, IN VIEW</span><span>Stored on this device</span></footer>
      </div>
    </main>
  );
}
