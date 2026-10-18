import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Plus,
  Trash2,
} from "lucide-react";
import type { LifeData, StudyModule } from "@/lib/life-data";
import { WEEKLY_STUDY_SCHEDULE } from "@/lib/study-curriculum";
import "./study-dashboard.css";

type Props = {
  data: LifeData;
  update: <K extends keyof LifeData>(key: K, value: LifeData[K]) => void;
};

const timeBuckets = [
  { label: "Morning", range: "5 am–noon", includes: (hour: number) => hour >= 5 && hour < 12 },
  { label: "Afternoon", range: "noon–5 pm", includes: (hour: number) => hour >= 12 && hour < 17 },
  { label: "Evening", range: "5–9 pm", includes: (hour: number) => hour >= 17 && hour < 21 },
  { label: "Night", range: "9 pm–5 am", includes: (hour: number) => hour >= 21 || hour < 5 },
];

function formatClock(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatHourRange(hour: number) {
  const start = new Date(2000, 0, 1, hour);
  const end = new Date(2000, 0, 1, hour + 1);
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

export function StudyDashboard({ data, update }: Props) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const groups = useMemo(() => {
    const grouped = new Map<string, StudyModule[]>();
    for (const module of data.modules) {
      grouped.set(module.category, [
        ...(grouped.get(module.category) ?? []),
        module,
      ]);
    }
    return [...grouped.entries()];
  }, [data.modules]);
  const todayName = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date());
  const todaySchedule = WEEKLY_STUDY_SCHEDULE.find(({ day }) => day === todayName);
  const recentCompletions = data.completionEvents
    .filter((event) => {
      const timestamp = new Date(event.completedAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
    })
    .slice()
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const bucketCounts = timeBuckets.map((bucket) => ({
    ...bucket,
    count: recentCompletions.filter((event) =>
      bucket.includes(new Date(event.completedAt).getHours()),
    ).length,
  }));
  const hourCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: recentCompletions.filter(
      (event) => new Date(event.completedAt).getHours() === hour,
    ).length,
  }));
  const weekdayCounts = WEEKLY_STUDY_SCHEDULE.map(({ day }) => ({
    day,
    count: recentCompletions.filter(
      (event) => new Intl.DateTimeFormat(undefined, { weekday: "long" })
        .format(new Date(event.completedAt)) === day,
    ).length,
  }));
  const mostActiveHour = hourCounts.reduce(
    (best, current) => current.count > best.count ? current : best,
    hourCounts[0],
  );
  const mostActiveDay = weekdayCounts.reduce(
    (best, current) => current.count > best.count ? current : best,
    weekdayCounts[0],
  );

  const addModule = () => {
    const subject = category.trim() || "General";
    if (!title.trim()) return;
    const moduleNumber =
      data.modules
        .filter((module) => module.category.toLowerCase() === subject.toLowerCase())
        .reduce((max, module) => Math.max(max, module.moduleNumber), 0) + 1;
    update("modules", [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        category: subject,
        title: title.trim(),
        moduleNumber,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        done: false,
        scheduledDays: [],
      },
      ...data.modules,
    ]);
    setTitle("");
    setNotes("");
  };

  const toggleModule = (id: string) => {
    const module = data.modules.find((item) => item.id === id);
    if (!module) return;
    const completedAt = module.done ? undefined : new Date().toISOString();
    update(
      "modules",
      data.modules.map((item) =>
        item.id === id ? { ...item, done: !item.done, completedAt } : item,
      ),
    );
    if (completedAt) {
      update("completionEvents", [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          kind: "module",
          itemId: module.id,
          title: module.title,
          category: module.category,
          completedAt,
        },
        ...data.completionEvents,
      ]);
    }
  };

  const completed = data.modules.filter((module) => module.done).length;

  return (
    <div className="study-dashboard">
      <header className="study-dashboard-heading">
        <div>
          <p className="eyebrow">LEARNING LIBRARY</p>
          <h1 className="serif">Keep what you learn.</h1>
          <p>A growing shelf of your study, organized by subject and in sequence.</p>
        </div>
        <div className="study-progress">
          <span>{completed} completed</span>
          <b>{data.modules.length} modules</b>
        </div>
      </header>

      <div className="study-summary-grid">
        <section className="study-dashboard-card study-schedule-card">
          <div className="study-card-heading">
            <span className="study-card-icon"><CalendarDays size={18} /></span>
            <div>
              <h2>Your weekly study plan</h2>
              <p>Today: {todaySchedule?.subjects.join(" · ") ?? "No study scheduled"}</p>
            </div>
          </div>
          <div className="study-week-list">
            {WEEKLY_STUDY_SCHEDULE.map(({ day, subjects }) => (
              <div className={`study-week-row${todayName === day ? " is-today" : ""}`} key={day}>
                <b>{day}</b>
                <span>{subjects.join(" · ")}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="study-dashboard-card study-completion-card">
          <div className="study-card-heading">
            <span className="study-card-icon"><Clock3 size={18} /></span>
            <div>
              <h2>When you get things done</h2>
              <p>Task and module check-offs · last 30 days</p>
            </div>
          </div>
          {recentCompletions.length ? (
            <>
              <div className="study-insight-pair">
                <div>
                  <span>Most active time</span>
                  <strong>{formatHourRange(mostActiveHour.hour)}</strong>
                  <small>{mostActiveHour.count} {mostActiveHour.count === 1 ? "completion" : "completions"}</small>
                </div>
                <div>
                  <span>Most active day</span>
                  <strong>{mostActiveDay.day}</strong>
                  <small>{mostActiveDay.count} completions</small>
                </div>
              </div>
              <div className="study-bucket-list" aria-label="Completions by time of day">
                {bucketCounts.map(({ label, range, count }) => (
                  <span key={label}>{label}<small>{range}</small><b>{count}</b></span>
                ))}
              </div>
              <p className="study-completion-caption">
                {recentCompletions.length} recorded {recentCompletions.length === 1 ? "completion" : "completions"} in the last 30 days.
              </p>
            </>
          ) : (
            <p className="study-empty-copy">
              No completion times are recorded yet. Check off a task or module and this will show when you tend to get things done.
            </p>
          )}
        </section>
      </div>

      <div className="study-dashboard-grid">
        <section className="study-dashboard-card study-add-card">
          <div className="study-card-heading">
            <span className="study-card-icon"><BookOpen size={18} /></span>
            <div>
              <h2>Add a module</h2>
              <p>Your curriculum is loaded below. New modules are numbered within each category.</p>
            </div>
          </div>
          <label className="study-field">
            <span>Category</span>
            <input
              data-testid="module-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Design, finance, languages…"
            />
          </label>
          <label className="study-field">
            <span>Module name</span>
            <input
              data-testid="module-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What did you study?"
            />
          </label>
          <label className="study-field">
            <span>Notes and takeaways</span>
            <textarea
              data-testid="module-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Capture an idea worth remembering…"
              rows={4}
            />
          </label>
          <button
            className="study-primary-button"
            data-testid="add-module"
            type="button"
            onClick={addModule}
            disabled={!title.trim()}
          >
            <Plus size={16} /> Save module
          </button>
        </section>

        <section className="study-dashboard-card study-library-card">
          <div className="study-library-heading">
            <div>
              <p className="eyebrow">YOUR LIBRARY</p>
              <h2>{data.modules.length ? "Study modules" : "Your first module starts here"}</h2>
            </div>
            <span>{groups.length} {groups.length === 1 ? "subject" : "subjects"} · {completed} completed</span>
          </div>
          {groups.length ? (
            groups.map(([subject, modules]) => (
              <section className="study-module-group" key={subject}>
                <header>
                  <h3>{subject}</h3>
                  <span>{modules.length} {modules.length === 1 ? "module" : "modules"}</span>
                </header>
                <div className="study-module-list">
                  {modules
                    .slice()
                    .sort((a, b) => a.moduleNumber - b.moduleNumber)
                    .map((module) => (
                      <article
                        className={`study-module-row${module.done ? " is-done" : ""}`}
                        key={module.id}
                      >
                        <span className="study-module-number">
                          {module.moduleLabel ?? String(module.moduleNumber).padStart(2, "0")}
                        </span>
                        <div className="study-module-copy">
                          <b>{module.title}</b>
                          <small>
                            {module.scheduledDays?.length
                              ? module.scheduledDays.map((day) => day.slice(0, 3)).join(" · ")
                              : "No weekly schedule"}
                            {module.scheduleNote ? ` · ${module.scheduleNote}` : ""}
                            {module.notes ? ` · ${module.notes}` : ""}
                          </small>
                          {module.done && (
                            <small className="study-module-completion">
                              {module.completedAt
                                ? `Completed at ${formatClock(module.completedAt)}`
                                : "Already complete · time not recorded"}
                            </small>
                          )}
                        </div>
                        <button
                          className="study-module-done"
                          aria-pressed={module.done}
                          aria-label={`Mark ${module.title} ${module.done ? "incomplete" : "complete"}`}
                          data-testid={`module-done-${module.id}`}
                          type="button"
                          onClick={() => toggleModule(module.id)}
                        >
                          <span>{module.done && <Check size={13} />}</span>
                          {module.done ? "Done" : "To do"}
                        </button>
                        <button
                          className="study-icon-button"
                          aria-label={`Delete ${module.title}`}
                          data-testid={`remove-module-${module.id}`}
                          type="button"
                          onClick={() =>
                            update(
                              "modules",
                              data.modules.filter((item) => item.id !== module.id),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))}
                </div>
              </section>
            ))
          ) : (
            <p className="study-empty-copy">
              Add a subject and a title. Modules will be numbered as your library grows.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
