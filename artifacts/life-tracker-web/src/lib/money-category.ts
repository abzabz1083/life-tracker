const CATEGORY_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\b(?:biscuits?|cookies?|snacks?|groceries|grocery|food|bread|milk|eggs?|rice|pasta|chicken|meat|fish|fruit|vegetables?|veg|coffee|tea|water|juice|drinks?|restaurant|takeaway|takeout|lunch|dinner|breakfast|meal|sweets?|chocolate|crisps?|chips?)\b/i,
    "Food",
  ],
  [/\b(?:taxi|uber|careem|fuel|petrol|gasoline|parking|bus|train|metro|transport)\b/i, "Transport"],
  [/\b(?:rent|utility|utilities|electricity|internet|household|cleaning|furniture|home)\b/i, "Home"],
  [/\b(?:pharmacy|medicine|medication|doctor|dentist|clinic|health)\b/i, "Health"],
  [/\b(?:subscription|netflix|spotify|icloud|membership)\b/i, "Subscriptions"],
  [/\b(?:clothes|clothing|shoes|electronics|shopping)\b/i, "Shopping"],
];

export function inferExpenseCategory(title: string, suggestedCategory?: string): string {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(title)) return category;
  }

  const suggested = suggestedCategory?.trim();
  if (!suggested) return "Other";

  if (/\b(?:food|groceries|grocery)\b/i.test(suggested)) return "Food";
  return suggested;
}
