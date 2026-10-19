export const EXPENSE_CATEGORIES = [
  "Food",
  "Housing",
  "Utilities",
  "Transport",
  "Health",
  "Home",
  "Shopping",
  "Subscriptions",
  "Entertainment",
  "Travel",
  "Education",
  "Personal care",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Benefits",
  "Investment",
  "Other income",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

const EXPENSE_RULES: ReadonlyArray<readonly [RegExp, ExpenseCategory]> = [
  [/\b(?:rent|mortgage|landlord|accommodation|housing)\b/i, "Housing"],
  [/\b(?:electricity|electric|utility|utilities|water bill|gas bill|internet bill|phone bill)\b/i, "Utilities"],
  [
    /\b(?:biscuits?|cookies?|snacks?|groceries|grocery|food|bread|milk|eggs?|rice|pasta|chicken|meat|fish|fruit|vegetables?|veg|coffee|tea|water|juice|drinks?|restaurant|takeaway|takeout|lunch|dinner|breakfast|meal|sweets?|chocolate|crisps?|chips?)\b/i,
    "Food",
  ],
  [/\b(?:taxi|uber|careem|fuel|petrol|gasoline|parking|bus|train|metro|transport)\b/i, "Transport"],
  [/\b(?:pharmacy|medicine|medication|doctor|dentist|clinic|health|hospital)\b/i, "Health"],
  [/\b(?:subscription|netflix|spotify|icloud|membership)\b/i, "Subscriptions"],
  [/\b(?:flight|airfare|hotel|holiday|vacation|travel|luggage)\b/i, "Travel"],
  [/\b(?:movie|cinema|concert|theatre|theater|game|entertainment)\b/i, "Entertainment"],
  [/\b(?:tuition|course|class|school|education|textbook)\b/i, "Education"],
  [/\b(?:haircut|salon|cosmetics|toiletries|personal care|skincare)\b/i, "Personal care"],
  [/\b(?:household|cleaning|furniture|home|decor)\b/i, "Home"],
  [/\b(?:clothes|clothing|shoes|electronics|shopping)\b/i, "Shopping"],
];

function expenseCategoryFromText(value: string): ExpenseCategory | undefined {
  return EXPENSE_RULES.find(([pattern]) => pattern.test(value))?.[1];
}

function expenseCategoryAlias(value: string): ExpenseCategory | undefined {
  const normalized = value.trim().toLocaleLowerCase().replace(/[^a-z]+/g, " ");
  const aliases: Record<string, ExpenseCategory> = {
    food: "Food",
    groceries: "Food",
    grocery: "Food",
    dining: "Food",
    housing: "Housing",
    rent: "Housing",
    utilities: "Utilities",
    bills: "Utilities",
    transport: "Transport",
    transportation: "Transport",
    travel: "Travel",
    health: "Health",
    medical: "Health",
    home: "Home",
    household: "Home",
    shopping: "Shopping",
    retail: "Shopping",
    subscriptions: "Subscriptions",
    entertainment: "Entertainment",
    education: "Education",
    "personal care": "Personal care",
    other: "Other",
  };
  return aliases[normalized];
}

function incomeCategory(value: string): IncomeCategory {
  const normalized = value.trim().toLocaleLowerCase().replace(/[^a-z]+/g, " ");
  if (/\b(?:salary|payroll|wage|employment)\b/.test(normalized)) return "Salary";
  if (/\b(?:freelance|contract|consulting|client)\b/.test(normalized)) return "Freelance";
  if (/\b(?:benefit|benefits|pension|allowance)\b/.test(normalized)) return "Benefits";
  if (/\b(?:investment|dividend|interest|stocks?)\b/.test(normalized)) return "Investment";
  return "Other income";
}

export function inferExpenseCategory(title: string, suggestedCategory?: string): ExpenseCategory {
  return (
    expenseCategoryFromText(title) ??
    (suggestedCategory ? expenseCategoryFromText(suggestedCategory) : undefined) ??
    (suggestedCategory ? expenseCategoryAlias(suggestedCategory) : undefined) ??
    "Other"
  );
}

export function normalizeMoneyCategory(
  kind: "income" | "expense",
  category: string | undefined,
  title: string,
): string {
  return kind === "expense"
    ? inferExpenseCategory(title, category)
    : incomeCategory(`${category ?? ""} ${title}`);
}
