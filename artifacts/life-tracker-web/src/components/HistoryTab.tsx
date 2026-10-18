import { useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Dumbbell,
  Filter,
  Heart,
  Mic2,
  NotebookPen,
  Search,
  Utensils,
  Wallet,
} from "lucide-react";
import type { LifeData } from "@/lib/life-data";
import "./history-tab.css";

type Props = { data: LifeData };
type FilterKey =
  | "all"
  | "tasks"
  | "money"
  | "learning"
  | "meals"
  | "training"
  | "wellbeing"
  | "library"
  | "notes"
  | "bills";
type HistorySection = "reflections" | "days" | "words" | "activity";

type TimelineItem = {
  id: string;
  category: Exclude<FilterKey, "all" | "bills">;
  title: string;
  detail: string;
  timestamp: string;
  dateKey: string;
  icon: typeof Activity;
  tone: string;
  status?: string;
  amount?: number;
};

const filters: { key: FilterKey; label: string; icon: typeof Activity }[] = [
  { key: "all", label: "All records", icon: Activity },
  { key: "tasks", label: "Tasks", icon: CheckCircle2 },
  { key: "money", label: "Money", icon: Wallet },
  { key: "learning", label: "Learning", icon: BookOpen },
  { key: "meals", label: "Meals", icon: Utensils },
  { key: "training", label: "Training", icon: Dumbbell },
  { key: "wellbeing", label: "Daily check-ins", icon: Heart },
  { key: "library", label: "Saved library", icon: NotebookPen },
  { key: "notes", label: "Voice notes", icon: Mic2 },
  { key: "bills", label: "Planned bills", icon: Clock3 },
];

function dateValue(value: string): number {
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: string): string {
  const exact = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exact) return `${exact[1]}-${exact[2]}-${exact[3]}`;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const timestamp = dateValue(value);
  if (!timestamp) return value || "Date not recorded";
  return new Intl.DateTimeFormat(undefined, options ?? {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatDateTime(value: string): string {
  if (!value) return "Time not recorded";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const timestamp = dateValue(value);
  if (!timestamp) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function ordinal(value: number): string {
  const remainder = value % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : value % 10 === 1
      ? "st"
      : value % 10 === 2
        ? "nd"
        : value % 10 === 3
          ? "rd"
          : "th";
  return `${value}${suffix}`;
}

function getTimelineItems(data: LifeData): TimelineItem[] {
  const items: TimelineItem[] = [];

  data.tasks.forEach((task) => {
    const timestamp = task.done ? task.completedAt ?? "" : task.date;
    items.push({
      id: `task-${task.id}`,
      category: "tasks",
      title: task.title,
      detail: task.done && !task.completedAt ? "Completed · exact time not recorded" : "Task",
      timestamp,
      dateKey: dateOnly(timestamp),
      icon: task.done ? Check : Circle,
      tone: "task",
      status: task.done ? "Completed" : "Open",
    });
  });

  data.money.forEach((entry) => items.push({
    id: `money-${entry.id}`,
    category: "money",
    title: entry.title,
    detail: `${entry.kind === "income" ? "Income" : "Expense"}${entry.category ? ` · ${entry.category}` : ""}`,
    timestamp: entry.date,
    dateKey: dateOnly(entry.date),
    icon: Wallet,
    tone: entry.kind === "income" ? "income" : "expense",
    amount: entry.baseAmount,
    status: entry.kind === "income" ? "Income" : "Expense",
  }));

  data.modules.forEach((module) => {
    const timestamp = module.done ? module.completedAt ?? "" : module.createdAt;
    items.push({
      id: `module-${module.id}`,
      category: "learning",
      title: module.title,
      detail: `${module.category}${module.moduleLabel ? ` · Module ${module.moduleLabel}` : ""}${module.notes ? ` · ${module.notes}` : ""}${module.done && !module.completedAt ? " · Completed before time tracking" : ""}`,
      timestamp,
      dateKey: dateOnly(timestamp),
      icon: BookOpen,
      tone: "learning",
      status: module.done ? "Completed" : "In progress",
    });
  });

  data.completionEvents.forEach((event) => {
    const currentTaskAlreadyShowsThis = event.kind === "task" &&
      data.tasks.some((task) => task.id === event.itemId && task.completedAt === event.completedAt);
    const currentModuleAlreadyShowsThis = event.kind === "module" &&
      data.modules.some((module) => module.id === event.itemId && module.completedAt === event.completedAt);
    if (currentTaskAlreadyShowsThis || currentModuleAlreadyShowsThis) return;
    items.push({
      id: `completion-${event.id}`,
      category: event.kind === "task" ? "tasks" : "learning",
      title: event.title,
      detail: event.kind === "task"
        ? "Task completion"
        : `${event.category ?? "Study module"} · module completion`,
      timestamp: event.completedAt,
      dateKey: dateOnly(event.completedAt),
      icon: event.kind === "task" ? Check : BookOpen,
      tone: event.kind === "task" ? "task" : "learning",
      status: "Completed",
    });
  });

  data.meals.forEach((meal) => {
    const combinedDate = meal.time ? `${dateOnly(meal.date)}T${meal.time}` : meal.date;
    items.push({
      id: `meal-${meal.id}`,
      category: "meals",
      title: meal.name,
      detail: `${Math.round(meal.calories)} kcal · P ${Math.round(meal.protein)}g · C ${Math.round(meal.carbs)}g · F ${Math.round(meal.fat)}g${meal.source ? ` · ${meal.source}` : ""}`,
      timestamp: combinedDate,
      dateKey: dateOnly(meal.date),
      icon: Utensils,
      tone: "meal",
      status: `${Math.round(meal.protein)}g protein`,
    });
  });

  data.workouts.forEach((workout) => items.push({
    id: `workout-${workout.id}`,
    category: "training",
    title: workout.exercise,
    detail: `${workout.sets} sets · ${workout.reps} reps${workout.weight ? ` · ${workout.weight} kg` : ""}`,
    timestamp: workout.finishedAt
      ? `${dateOnly(workout.date)}T${workout.finishedAt}`
      : workout.date,
    dateKey: dateOnly(workout.date),
    icon: Dumbbell,
    tone: "training",
    status: "Workout",
  }));

  data.dayChecks.forEach((check) => {
    const activities = [
      check.gym === "went" ? "Gym completed" : check.gym === "missed" ? "Gym missed" : "",
      check.diet === "good" ? "Diet on track" : check.diet === "off" ? "Diet was off-plan" : "",
    ].filter(Boolean);
    if (activities.length) items.push({
      id: `check-${check.date}`,
      category: "wellbeing",
      title: activities.join(" · "),
      detail: "Daily check-in",
      timestamp: check.date,
      dateKey: dateOnly(check.date),
      icon: Heart,
      tone: "wellbeing",
      status: "Check-in",
    });
  });

  data.savedFoods.forEach((food) => items.push({
    id: `food-${food.id}`,
    category: "library",
    title: food.name,
    detail: `Saved food · ${Math.round(food.caloriesPer100)} kcal / 100 g · P ${Math.round(food.proteinPer100)}g · C ${Math.round(food.carbsPer100)}g · F ${Math.round(food.fatPer100)}g${food.source ? ` · ${food.source}` : ""}`,
    timestamp: food.createdAt,
    dateKey: dateOnly(food.createdAt),
    icon: Utensils,
    tone: "library",
    status: "Food",
  }));

  data.savedMeals.forEach((meal) => items.push({
    id: `saved-meal-${meal.id}`,
    category: "library",
    title: meal.name,
    detail: `Saved meal · ${meal.ingredients.length} ingredients`,
    timestamp: meal.createdAt,
    dateKey: dateOnly(meal.createdAt),
    icon: NotebookPen,
    tone: "library",
    status: "Meal",
  }));

  data.voiceNotes.forEach((note) => items.push({
    id: `note-${note.id}`,
    category: "notes",
    title: note.text.trim().replace(/\s+/g, " ") || "Voice note",
    detail: "Voice note",
    timestamp: note.createdAt,
    dateKey: dateOnly(note.createdAt),
    icon: Mic2,
    tone: "notes",
    status: "Recorded",
  }));

  return items.sort((a, b) => dateValue(b.timestamp) - dateValue(a.timestamp));
}

export default function HistoryTab({ data }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [section, setSection] = useState<HistorySection>("reflections");
  const [query, setQuery] = useState("");
  const items = useMemo(() => getTimelineItems(data), [data]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = useMemo(
    () => items.filter((item) => {
      const matchesCategory = activeFilter === "all" || item.category === activeFilter;
      const matchesSearch = !normalizedQuery
        || `${item.title} ${item.detail} ${item.status ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    }),
    [activeFilter, items, normalizedQuery],
  );
  const billsVisible = activeFilter === "all" || activeFilter === "bills";
  const filteredBills = data.bills.filter((bill) => (
    !normalizedQuery || `${bill.title} recurring monthly ${bill.dueDay}`.toLocaleLowerCase().includes(normalizedQuery)
  ));
  const reviewList = [...data.weeklyReviews].sort(
    (a, b) => dateValue(b.createdAt) - dateValue(a.createdAt),
  );
  const filteredReviews = reviewList.filter((review) => (
    !normalizedQuery
      || `${review.summary} ${review.snapshot} ${review.weekStart} ${review.weekEnd}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
  ));
  const dailySummaries = [...data.dailySummaries].sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt)).filter((item) =>
    !normalizedQuery || `${item.date} ${item.summary} ${item.snapshot}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const savedWords = [...data.savedWords].sort((a, b) => dateValue(b.savedAt) - dateValue(a.savedAt)).filter((item) =>
    !normalizedQuery || `${item.word} ${item.partOfSpeech} ${item.definition} ${item.sentence} ${item.conversation.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const showBills = billsVisible && filteredBills.length > 0;
  const noResults = filteredItems.length === 0 && !showBills;

  return (
    <div className="history-tab">
      <header className="history-heading">
        <div>
          <p className="history-eyebrow">YOUR RECORD, AT YOUR PACE</p>
          <h1 className="history-title">A life, in the details.</h1>
          <p className="history-intro">A private look back at what you’ve done, learned, eaten, and kept.</p>
        </div>
        <div className="history-local-note" aria-label="Local data">
          <span className="history-local-dot" />
          Stored on this device
        </div>
      </header>

      <div className="history-subtabs" role="tablist" aria-label="History categories">
        {([
          ["reflections", "Weekly reflections"],
          ["days", "Daily summaries"],
          ["words", `Words${data.savedWords.length ? ` · ${data.savedWords.length}` : ""}`],
          ["activity", "All activity"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} data-testid={`history-section-${key}`} onClick={() => setSection(key)}>{label}</button>
        ))}
      </div>

      {section === "reflections" && <section className="history-reviews" aria-labelledby="history-reviews-title">
        <div className="history-section-heading">
          <div>
            <p className="history-eyebrow">LOOKING BACK</p>
            <h2 id="history-reviews-title">Weekly reflections</h2>
          </div>
          <span className="history-count" data-testid="history-review-count">
            {filteredReviews.length} {filteredReviews.length === 1 ? "review" : "reviews"}
          </span>
        </div>
        {filteredReviews.length ? (
          <div className="history-review-list">
            {filteredReviews.map((review) => (
              <article className="history-review" key={review.id} data-testid={`history-review-${review.id}`}>
                <div className="history-review-mark" aria-hidden="true"><NotebookPen size={17} /></div>
                <div className="history-review-body">
                  <div className="history-review-meta">
                    <span className="history-review-range">
                      {formatDate(review.weekStart, { month: "short", day: "numeric" })}
                      <span aria-hidden="true"> — </span>
                      {formatDate(review.weekEnd, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <time dateTime={review.createdAt} data-testid={`history-review-created-${review.id}`}>
                      Written {formatDate(review.createdAt)}
                    </time>
                  </div>
                  <p className="history-review-summary" data-testid={`history-review-summary-${review.id}`}>
                    {review.summary || "No reflection was written for this week."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="history-review-empty" data-testid="history-reviews-empty">
            <span className="history-empty-mark"><NotebookPen size={17} /></span>
            <div>
              <strong>{normalizedQuery ? "No saved review matches this search." : "Your first weekly reflection will live here."}</strong>
              <p>{normalizedQuery ? "Try another phrase or clear the search." : "When you write a review, its summary and the week it covers will be easy to find."}</p>
            </div>
          </div>
        )}
      </section>}

      {section === "days" && <section className="history-reviews" aria-labelledby="history-days-title">
        <div className="history-section-heading"><div><p className="history-eyebrow">CLOSING THE DAY</p><h2 id="history-days-title">Daily summaries</h2><p className="history-section-subtitle">Saved locally, with the records used to write each reflection.</p></div><span className="history-count" data-testid="history-daily-count">{dailySummaries.length} saved</span></div>
        {dailySummaries.length ? <div className="history-review-list">{dailySummaries.map((summary) => <article className="history-review" key={summary.id} data-testid={`history-daily-summary-${summary.id}`}><div className="history-review-mark"><NotebookPen size={17}/></div><div className="history-review-body"><div className="history-review-meta"><span className="history-review-range">{formatDate(summary.date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</span><time dateTime={summary.createdAt}>Written {formatDate(summary.createdAt)}</time></div><p className="history-review-summary">{summary.summary}</p><details className="history-snapshot" data-testid={`history-snapshot-${summary.id}`}><summary>View the day’s snapshot</summary><pre>{summary.snapshot}</pre></details></div></article>)}</div> : <div className="history-review-empty" data-testid="history-daily-empty"><span className="history-empty-mark"><NotebookPen size={17}/></span><div><strong>{normalizedQuery ? "No saved daily summary matches this search." : "No daily summaries yet."}</strong><p>Daily reflections created during the 10 p.m.–2:59 a.m. window will be kept here.</p></div></div>}
      </section>}

      {section === "words" && <section className="history-reviews" aria-labelledby="history-words-title">
        <div className="history-section-heading"><div><p className="history-eyebrow">WORDS TO KEEP</p><h2 id="history-words-title">Your saved vocabulary</h2><p className="history-section-subtitle">Examples and conversations saved from Word of the Week.</p></div><span className="history-count" data-testid="history-word-count">{savedWords.length} saved</span></div>
        {savedWords.length ? <div className="history-word-list">{savedWords.map((word) => <article className="history-word-card" key={word.id} data-testid={`history-saved-word-${word.id}`}><div className="history-review-meta"><span className="history-review-range">{formatDate(word.date, { month: "short", day: "numeric", year: "numeric" })} · week of {word.week}</span><time dateTime={word.savedAt}>Saved {formatDate(word.savedAt)}</time></div><h3>{word.word} <small>{word.partOfSpeech}</small></h3><p>{word.definition}</p><blockquote>“{word.sentence}”</blockquote><div className="history-word-conversation"><span>A · {word.conversation[0]}</span><span>B · {word.conversation[1]}</span></div></article>)}</div> : <div className="history-review-empty" data-testid="history-words-empty"><span className="history-empty-mark"><BookOpen size={17}/></span><div><strong>{normalizedQuery ? "No saved word matches this search." : "Your vocabulary starts here."}</strong><p>Save a Word of the Week on Today and its full example will stay in this history.</p></div></div>}
      </section>}

      {section === "activity" && <section className="history-activity" aria-labelledby="history-activity-title">
        <div className="history-section-heading history-activity-heading">
          <div>
            <p className="history-eyebrow">THE DAY-TO-DAY</p>
            <h2 id="history-activity-title">All activity</h2>
            <p className="history-section-subtitle">Browse your existing records, newest first.</p>
          </div>
          <span className="history-count" data-testid="history-activity-count">
            {filteredItems.length + (showBills ? filteredBills.length : 0)} records
          </span>
        </div>

        <div className="history-controls">
          <label className="history-search">
            <Search size={16} aria-hidden="true" />
            <span className="history-visually-hidden">Search records</span>
            <input
              data-testid="history-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your records"
            />
            {query && (
              <button
                className="history-clear-search"
                data-testid="history-clear-search"
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </label>
          <div className="history-filter-label"><Filter size={14} aria-hidden="true" /> Filter by</div>
          <div className="history-filter-list" role="group" aria-label="Filter activity by category">
            {filters.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`history-filter${activeFilter === key ? " is-active" : ""}`}
                data-testid={`history-filter-${key}`}
                aria-pressed={activeFilter === key}
                onClick={() => setActiveFilter(key)}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="history-results" aria-live="polite">
          {showBills && (
            <section className="history-planned" aria-labelledby="history-planned-title">
              <div className="history-planned-heading">
                <span className="history-planned-icon"><Clock3 size={16} /></span>
                <div>
                  <h3 id="history-planned-title">Planned recurring bills</h3>
                  <p>Monthly commitments, shown separately from dated transactions.</p>
                </div>
              </div>
              <div className="history-planned-list">
                {filteredBills.map((bill) => (
                  <article className="history-planned-row" key={bill.id} data-testid={`history-bill-${bill.id}`}>
                    <div>
                      <strong data-testid={`history-bill-title-${bill.id}`}>{bill.title}</strong>
                      <span>Due on the {ordinal(bill.dueDay)} of each month</span>
                    </div>
                    <b data-testid={`history-bill-amount-${bill.id}`}>
                      {formatAmount(bill.baseAmount, data.settings.baseCurrency)}
                    </b>
                  </article>
                ))}
              </div>
            </section>
          )}

          {filteredItems.length > 0 && (
            <div className="history-timeline" data-testid="history-timeline">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const previous = filteredItems[index - 1];
                const showDate = !previous || previous.dateKey !== item.dateKey;
                return (
                  <div className="history-timeline-item" key={item.id} data-testid={`history-record-${item.id}`}>
                    {showDate && (
                      <h3 className="history-date-heading" data-testid={`history-date-${item.id}`}>
                        {formatDate(item.dateKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </h3>
                    )}
                    <article className="history-record">
                      <span className={`history-record-icon ${item.tone}`} aria-hidden="true"><Icon size={16} /></span>
                      <div className="history-record-copy">
                        <strong data-testid={`history-record-title-${item.id}`}>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <div className="history-record-trailing">
                        {item.amount !== undefined && (
                          <b className={item.tone === "income" ? "history-amount-income" : ""}>
                            {item.tone === "expense" ? "−" : "+"}
                            {formatAmount(item.amount, data.settings.baseCurrency)}
                          </b>
                        )}
                        {item.status && <span className={`history-status ${item.tone}`}>{item.status}</span>}
                        <time dateTime={item.timestamp} data-testid={`history-record-time-${item.id}`}>
                          {(item.category === "meals" || item.category === "training") && item.timestamp.includes("T")
                            ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(item.timestamp))
                            : formatDateTime(item.timestamp)}
                        </time>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}

          {noResults && (
            <div className="history-empty" data-testid="history-empty-state">
              <span className="history-empty-mark"><Search size={18} /></span>
              <h3>{normalizedQuery ? "Nothing matches that search." : "No records in this view yet."}</h3>
              <p>
                {normalizedQuery
                  ? "Try another phrase or clear the search to see more of your history."
                  : "Records you already keep in daybook will appear here as they build up."}
              </p>
              {normalizedQuery && (
                <button
                  type="button"
                  className="history-reset-button"
                  data-testid="history-reset-search"
                  onClick={() => {
                    setQuery("");
                    setActiveFilter("all");
                  }}
                >
                  Show all records
                </button>
              )}
            </div>
          )}
        </div>
      </section>}
    </div>
  );
}
