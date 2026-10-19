export type NormalizedNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function isPlausibleNutrition(values: NormalizedNutrition): boolean {
  return values.calories <= 1000 &&
    values.protein <= 100 &&
    values.carbs <= 100 &&
    values.fat <= 100 &&
    values.protein + values.carbs + values.fat <= 105;
}

export function foodNeedsNutritionClarification(food: string): string | undefined {
  const value = food.toLocaleLowerCase();
  const meat = /\b(chicken|beef|pork|turkey|lamb|salmon|tuna|fish|shrimp|prawn)\b/.test(value);
  const raw = /\b(raw|uncooked)\b/.test(value);
  const preparationMethod = /\b(boiled|poached|roasted|baked|grilled|fried|pan[\s-]fried|air[\s-]fried|steamed|smoked|braised|broiled)\b/.test(value);
  if (/\bchicken\b/.test(value) && !/\b(breast|thigh|wing|drumstick|leg|tender|whole|ground|minced)\b/.test(value)) {
    return "Specify the chicken cut (such as breast or thigh), raw or cooked state, and cooking method.";
  }
  if (meat && !raw && !preparationMethod) {
    return "Specify whether the meat or fish is raw or cooked and how it was prepared.";
  }
  if (meat && /\bcooked\b/.test(value) && !preparationMethod) {
    return "Specify the cooking method for this meat or fish, such as grilled, roasted, boiled or pan-fried.";
  }
  if (/\b(rice|pasta|noodles?|oats?|quinoa|beans?|lentils?|potatoes?)\b/.test(value) &&
      !/\b(raw|dry|dried|uncooked|cooked|boiled|steamed|baked|roasted|fried)\b/.test(value)) {
    return "Specify whether this food is dry/raw or cooked.";
  }
  return undefined;
}

type UsdaNutrient = {
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: unknown;
};

function numericValue(value: unknown): number | undefined {
  if (typeof value === "string" && !value.trim()) return undefined;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function grams(value: unknown, unitName?: string): number | undefined {
  const parsed = numericValue(value);
  if (parsed === undefined) return undefined;
  const unit = unitName?.trim().toLocaleLowerCase();
  if (unit === "g" || unit === "gram" || unit === "grams") return parsed;
  if (unit === "mg" || unit === "milligram" || unit === "milligrams") return parsed / 1000;
  if (unit === "ug" || unit === "µg" || unit === "mcg") return parsed / 1_000_000;
  if (unit === "kg") return parsed * 1000;
  return undefined;
}

function kilocalories(value: unknown, unitName?: string, nutrientNumber?: string): number | undefined {
  const parsed = numericValue(value);
  if (parsed === undefined) return undefined;
  const unit = unitName?.trim().toLocaleLowerCase().replace(/\s+/g, "");
  if (unit === "kj" || unit === "kilojoule" || unit === "kilojoules") return parsed / 4.184;
  if (unit === "kcal" || unit === "calorie" || unit === "calories") return parsed;
  if (nutrientNumber === "1062") return parsed / 4.184;
  if (["1008", "2047", "2048"].includes(nutrientNumber ?? "")) return parsed;
  return undefined;
}

function firstMatching<T>(
  values: T[],
  matches: (value: T) => boolean,
  hasValue: (value: T) => boolean,
): T | undefined {
  return values.find((value) => matches(value) && hasValue(value));
}

export function normalizeUsdaNutrition(nutrients: UsdaNutrient[]): NormalizedNutrition | undefined {
  const hasNumericValue = (nutrient: UsdaNutrient) => numericValue(nutrient.value) !== undefined;
  const energy = firstMatching(
    nutrients,
    (nutrient) => ["1008", "2047", "2048"].includes(nutrient.nutrientNumber ?? "") ||
      nutrient.nutrientNumber === "1062" ||
      /^(energy|calories?)$/i.test(nutrient.nutrientName?.trim() ?? ""),
    hasNumericValue,
  );
  const calories = energy
    ? kilocalories(energy.value, energy.unitName, energy.nutrientNumber)
    : undefined;

  const macro = (matches: (name: string) => boolean) => {
    const nutrient = firstMatching(
      nutrients,
      (item) => matches((item.nutrientName ?? "").toLocaleLowerCase()),
      hasNumericValue,
    );
    return nutrient ? grams(nutrient.value, nutrient.unitName) : undefined;
  };

  const protein = macro((name) => name === "protein");
  const carbs = macro((name) => name.includes("carbohydrate"));
  const fat = macro((name) => name.includes("total lipid") || name === "fat");
  if ([calories, protein, carbs, fat].some((value) => value === undefined)) return undefined;
  const result = { calories: calories!, protein: protein!, carbs: carbs!, fat: fat! };
  return isPlausibleNutrition(result) ? result : undefined;
}

export function normalizeOpenFoodFactsNutrition(
  nutriments: Record<string, unknown>,
): NormalizedNutrition | undefined {
  const caloriesKcal = numericValue(nutriments["energy-kcal_100g"]);
  const caloriesKj = numericValue(nutriments["energy-kj_100g"]);
  const calories = caloriesKcal ?? (caloriesKj === undefined ? undefined : caloriesKj / 4.184);
  const protein = numericValue(nutriments["proteins_100g"]);
  const carbs = numericValue(nutriments["carbohydrates_100g"]);
  const fat = numericValue(nutriments["fat_100g"]);
  if ([calories, protein, carbs, fat].some((value) => value === undefined)) return undefined;
  const result = { calories: calories!, protein: protein!, carbs: carbs!, fat: fat! };
  return isPlausibleNutrition(result) ? result : undefined;
}
