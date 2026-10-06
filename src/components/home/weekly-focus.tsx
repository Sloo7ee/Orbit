import { durationLabel } from "@/lib/domain/focus";
import type { weeklyFocus } from "@/lib/domain/home";
import type { Task } from "@/lib/domain/tasks";
export function WeeklyFocus({
  days,
  tasks,
  zone,
}: {
  days: ReturnType<typeof weeklyFocus>;
  tasks: Task[];
  zone: string;
}) {
  const total = days.reduce((s, d) => s + d.milliseconds, 0),
    max = Math.max(3600000, ...days.map((d) => d.milliseconds));
  const complete = tasks.filter((t) => !!t.completed_at).length,
    remaining = tasks.length - complete;
  return (
    <section className="home-study" aria-label="Study overview">
      <div className="weekly-focus">
        <div className="section-title">
          <div>
            <h2>Weekly Focus</h2>
            <p>
              Current week · {days[0].date} – {days[6].date} · {zone}
            </p>
          </div>
          <strong>{durationLabel(total)}</strong>
        </div>
        <ol className="focus-bars" aria-label="Completed study time by day">
          {days.map((d) => (
            <li key={d.date}>
              <span className="bar-value">{durationLabel(d.milliseconds)}</span>
              <div className="bar-track">
                <div
                  className="focus-bar"
                  style={{ height: `${(d.milliseconds / max) * 100}%` }}
                />
              </div>
              <span>{d.label}</span>
              <span className="sr-only">{d.date}</span>
            </li>
          ))}
        </ol>
        <p className="field-help">
          Completed focus only. Breaks and pauses are excluded.
        </p>
      </div>
      <div className="task-progress-panel">
        <div className="section-title">
          <h2>Task progress</h2>
          <span>{tasks.length} total</span>
        </div>
        <strong>
          {tasks.length ? Math.round((complete / tasks.length) * 100) : 0}
          <small>% complete</small>
        </strong>
        <div className="task-progress-track" aria-hidden="true">
          <span
            style={{
              width: `${tasks.length ? (complete / tasks.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p>
          <span>
            <i />
            Completed <b>{complete}</b>
          </span>
          <span>
            Remaining <b>{remaining}</b>
          </span>
        </p>
      </div>
    </section>
  );
}
