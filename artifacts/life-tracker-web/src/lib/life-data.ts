import {
  createCurriculumModules,
  STUDY_CURRICULUM_VERSION,
  type StudyWeekday,
} from "./study-curriculum";

export type Currency = "GBP" | "USD" | "AED" | "EUR";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  date: string;
  completedAt?: string;
};

export type MoneyEntry = {
  id: string;
  kind: "income" | "expense";
  title: string;
  category: string;
  amount: number;
  currency: Currency;
  baseAmount: number;
  date: string;
};

export type Bill = {
  id: string;
  title: string;
  amount: number;
  currency: Currency;
  baseAmount: number;
  dueDay: number;
};

export type StudyModule = {
  id: string;
  category: string;
  title: string;
  moduleNumber: number;
  moduleLabel?: string;
  notes: string;
  createdAt: string;
  done: boolean;
  completedAt?: string;
  scheduledDays?: StudyWeekday[];
  scheduleNote?: string;
  curriculumKey?: string;
};

export type CompletionEvent = {
  id: string;
  kind: "task" | "module";
  itemId: string;
  title: string;
  category?: string;
  completedAt: string;
};

export type MealIngredient = {
  id: string;
  name: string;
  source: string;
  grams: number;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
};

export type Meal = {
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
  photoKey?: string;
};

export type SavedFood = {
  id: string;
  name: string;
  source: string;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  photoKey?: string;
  createdAt: string;
};

export type SavedMeal = {
  id: string;
  name: string;
  ingredients: MealIngredient[];
  photoKey?: string;
  createdAt: string;
};

export type DayCheckIn = {
  date: string;
  gym: "went" | "missed" | null;
  diet: "good" | "off" | null;
};

export type WorkoutEntry = {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  finishedAt: string;
  date: string;
  photoKey?: string;
};

export type VoiceNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type WeeklyReview = {
  id: string;
  weekStart: string;
  weekEnd: string;
  createdAt: string;
  summary: string;
  snapshot: string;
};

export type SavedWord = {
  id: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  sentence: string;
  conversation: [string, string];
  week: string;
  date: string;
  savedAt: string;
};

export type DailySummary = {
  id: string;
  date: string;
  createdAt: string;
  summary: string;
  snapshot: string;
};

export type WeeklyWordSelection = {
  week: string;
  word: string;
};

export type Settings = {
  baseCurrency: Currency;
  monthlyIncomeTarget: number;
  monthlySpendingBudget: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  nutritionAiProvider: "openai" | "anthropic";
  mealPrompt: string;
  workoutPrompt: string;
  telegramChatId: string;
};

export type LifeData = {
  tasks: Task[];
  money: MoneyEntry[];
  bills: Bill[];
  modules: StudyModule[];
  meals: Meal[];
  savedFoods: SavedFood[];
  savedMeals: SavedMeal[];
  dayChecks: DayCheckIn[];
  workouts: WorkoutEntry[];
  voiceNotes: VoiceNote[];
  weeklyReviews: WeeklyReview[];
  savedWords: SavedWord[];
  dailySummaries: DailySummary[];
  weeklyWordSelection?: WeeklyWordSelection;
  completionEvents: CompletionEvent[];
  studyCurriculumVersion: number;
  settings: Settings;
};

export const createDefaultLifeData = (): LifeData => ({
  tasks: [],
  money: [],
  bills: [],
  modules: createCurriculumModules(),
  meals: [],
  savedFoods: [],
  savedMeals: [],
  dayChecks: [],
  workouts: [],
  voiceNotes: [],
  weeklyReviews: [],
  savedWords: [],
  dailySummaries: [],
  completionEvents: [],
  studyCurriculumVersion: STUDY_CURRICULUM_VERSION,
  settings: {
    baseCurrency: "GBP",
    monthlyIncomeTarget: 0,
    monthlySpendingBudget: 0,
    calorieTarget: 2000,
    proteinTarget: 120,
    carbsTarget: 0,
    fatTarget: 0,
    nutritionAiProvider: "openai",
    mealPrompt: "13:00",
    workoutPrompt: "20:00",
    telegramChatId: "",
  },
});

export function normalizeLifeData(value: unknown): LifeData {
  const defaults = createDefaultLifeData();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const stored = value as Partial<LifeData>;
  const savedSettings = (stored.settings ?? {}) as Partial<Settings> & {
    telegramChatId?: string;
  };
  const { telegramChatId: _legacyChatId, ...settings } = savedSettings;
  const savedModules = Array.isArray(stored.modules)
    ? stored.modules.map((module) => ({
        ...module,
        done: Boolean(module.done),
        scheduledDays: Array.isArray(module.scheduledDays) ? module.scheduledDays : [],
      }))
    : [];
  const importedVersion = Number(stored.studyCurriculumVersion) || 0;
  const modules =
    importedVersion >= STUDY_CURRICULUM_VERSION
      ? savedModules
      : [
          ...savedModules,
          ...createCurriculumModules().filter(
            (seed) =>
              !savedModules.some(
                (module) =>
                  module.category.trim().toLocaleLowerCase() ===
                    seed.category.toLocaleLowerCase() &&
                  module.title.trim().toLocaleLowerCase() ===
                    seed.title.toLocaleLowerCase(),
              ),
          ),
        ];

  const savedWords = Array.isArray(stored.savedWords)
    ? stored.savedWords.filter((item): item is SavedWord =>
        Boolean(item && typeof item === "object" &&
          typeof item.id === "string" && typeof item.word === "string" &&
          typeof item.partOfSpeech === "string" && typeof item.definition === "string" &&
          typeof item.sentence === "string" && Array.isArray(item.conversation) &&
          item.conversation.length === 2 && item.conversation.every((line) => typeof line === "string") &&
          typeof item.week === "string" && typeof item.date === "string" &&
          typeof item.savedAt === "string"),
      )
        .filter((item, index, all) =>
          all.findIndex((other) => other.word.trim().toLocaleLowerCase() === item.word.trim().toLocaleLowerCase()) === index,
        )
    : [];
  const dailySummaries = Array.isArray(stored.dailySummaries)
    ? stored.dailySummaries.filter((item): item is DailySummary =>
        Boolean(item && typeof item === "object" &&
          typeof item.id === "string" && typeof item.date === "string" &&
          typeof item.createdAt === "string" && typeof item.summary === "string" &&
          typeof item.snapshot === "string"),
      )
    : [];
  const weeklyWordSelection =
    stored.weeklyWordSelection &&
    typeof stored.weeklyWordSelection.week === "string" &&
    typeof stored.weeklyWordSelection.word === "string"
      ? stored.weeklyWordSelection
      : undefined;

  return {
    ...defaults,
    ...stored,
    tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
    money: Array.isArray(stored.money) ? stored.money : [],
    bills: Array.isArray(stored.bills) ? stored.bills : [],
    modules,
    meals: Array.isArray(stored.meals) ? stored.meals : [],
    savedFoods: Array.isArray(stored.savedFoods) ? stored.savedFoods : [],
    savedMeals: Array.isArray(stored.savedMeals) ? stored.savedMeals : [],
    dayChecks: Array.isArray(stored.dayChecks) ? stored.dayChecks : [],
    workouts: Array.isArray(stored.workouts) ? stored.workouts : [],
    voiceNotes: Array.isArray(stored.voiceNotes) ? stored.voiceNotes : [],
    weeklyReviews: Array.isArray(stored.weeklyReviews) ? stored.weeklyReviews : [],
    savedWords,
    dailySummaries,
    weeklyWordSelection,
    completionEvents: Array.isArray(stored.completionEvents)
      ? stored.completionEvents
      : [],
    studyCurriculumVersion: STUDY_CURRICULUM_VERSION,
    settings: { ...defaults.settings, ...settings },
  };
}

export const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
