import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Currency = "GBP" | "USD" | "AED" | "EUR";
export type Task = { id: string; title: string; done: boolean; date: string };
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
  notes: string;
  createdAt: string;
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
};
export type WorkoutEntry = {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  finishedAt: string;
  date: string;
  photoUri?: string;
};
export type VoiceNote = { id: string; text: string; createdAt: string };

export type LifeData = {
  tasks: Task[];
  money: MoneyEntry[];
  bills: Bill[];
  modules: StudyModule[];
  meals: Meal[];
  workouts: WorkoutEntry[];
  voiceNotes: VoiceNote[];
  settings: {
    baseCurrency: Currency;
    monthlyIncomeTarget: number;
    monthlySpendingBudget: number;
    calorieTarget: number;
    proteinTarget: number;
    mealPrompt: string;
    workoutPrompt: string;
    telegramChatId: string;
  };
};

const STORAGE_KEY = "life-tracker-state-v1";
const initialData: LifeData = {
  tasks: [],
  money: [],
  bills: [],
  modules: [],
  meals: [],
  workouts: [],
  voiceNotes: [],
  settings: {
    baseCurrency: "GBP",
    monthlyIncomeTarget: 0,
    monthlySpendingBudget: 0,
    calorieTarget: 2000,
    proteinTarget: 120,
    mealPrompt: "13:00",
    workoutPrompt: "20:00",
    telegramChatId: "",
  },
};

type LifeContextValue = {
  data: LifeData;
  ready: boolean;
  update: <K extends keyof LifeData>(key: K, value: LifeData[K]) => void;
};

const LifeContext = createContext<LifeContextValue | null>(null);

export function LifeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LifeData>(initialData);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<LifeData>;
          setData({
            ...initialData,
            ...parsed,
            settings: { ...initialData.settings, ...parsed.settings },
          });
        }
      })
      .catch(() => {
        // Keep a usable empty state if a previous local save is unreadable.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready]);

  const value = useMemo<LifeContextValue>(
    () => ({
      data,
      ready,
      update: (key, value) =>
        setData((current) => ({ ...current, [key]: value })),
    }),
    [data, ready],
  );

  return <LifeContext.Provider value={value}>{children}</LifeContext.Provider>;
}

export function useLife() {
  const value = useContext(LifeContext);
  if (!value) throw new Error("useLife must be used inside LifeProvider");
  return value;
}

export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

export function moneyLabel(amount: number, currency: Currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
