import { useMemo, useState } from "react";
import { BookOpen, Check, Plus, Trash2 } from "lucide-react";
import type { LifeData, StudyModule } from "@/lib/life-data";
import "./study-dashboard.css";

type Props = {
  data: LifeData;
  update: <K extends keyof LifeData>(key: K, value: LifeData[K]) => void;
};

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
      },
      ...data.modules,
    ]);
    setTitle("");
    setNotes("");
  };

  const toggleModule = (id: string) =>
    update(
      "modules",
      data.modules.map((module) =>
        module.id === id ? { ...module, done: !module.done } : module,
      ),
    );

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

      <div className="study-dashboard-grid">
        <section className="study-dashboard-card study-add-card">
          <div className="study-card-heading">
            <span className="study-card-icon"><BookOpen size={18} /></span>
            <div>
              <h2>Add a module</h2>
              <p>Module numbers are assigned within each category.</p>
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
            <span>{groups.length} {groups.length === 1 ? "subject" : "subjects"}</span>
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
                          {String(module.moduleNumber).padStart(2, "0")}
                        </span>
                        <div className="study-module-copy">
                          <b>{module.title}</b>
                          <small>
                            {new Intl.DateTimeFormat(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).format(new Date(module.createdAt))}
                            {module.notes ? ` · ${module.notes}` : ""}
                          </small>
                        </div>
                        <button
                          className="study-module-done"
                          aria-pressed={module.done}
                          aria-label={`${module.done ? "Mark" : "Mark"} ${module.title} ${module.done ? "incomplete" : "complete"}`}
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
