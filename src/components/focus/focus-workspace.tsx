"use client";
import { useActionNotification } from "@/components/ui/action-notifications";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { DateTime } from "luxon";
import { Play, Pause, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { useFocus } from "./focus-provider";
import {
  focusClock,
  durationLabel,
  timerLabel,
  type FocusSession,
  type FocusCommand,
} from "@/lib/domain/focus";
import type { Course, Semester } from "@/lib/supabase/database.types";
import type { Task } from "@/lib/domain/tasks";
function Association({
  courses,
  tasks,
  course,
  task,
  onCourse,
  onTask,
}: {
  courses: Course[];
  tasks: Task[];
  course: string;
  task: string;
  onCourse: (s: string) => void;
  onTask: (s: string) => void;
}) {
  const selected = tasks.find((t) => t.id === task);
  return (
    <div className="form-row">
      <label>
        Course (optional)
        <select
          value={course}
          disabled={!!selected?.course_id}
          onChange={(e) => onCourse(e.target.value)}
        >
          <option value="">No course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Task (optional)
        <select
          value={task}
          onChange={(e) => {
            onTask(e.target.value);
            const t = tasks.find((t) => t.id === e.target.value);
            if (t?.course_id) onCourse(t.course_id);
          }}
        >
          <option value="">No task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
              {t.completed_at ? " · Completed" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function FocusWorkspace({
  semester,
  semesters,
  courses,
  tasks,
  zone,
}: {
  semester: Semester;
  semesters: Semester[];
  courses: Course[];
  tasks: Task[];
  zone: string;
}) {
  const notify = useActionNotification();
  const { snapshot, now, busy, error, run, refresh } = useFocus();
  const startId = useRef<string | null>(null);
  useEffect(() => {
    if (snapshot.active) startId.current = null;
  }, [snapshot.active]);
  const [mode, setMode] = useState<"stopwatch" | "pomodoro">("stopwatch"),
    [focusMinutes, setFocusMinutes] = useState("25"),
    [breakMinutes, setBreakMinutes] = useState("5");
  const [course, setCourse] = useState(""),
    [task, setTask] = useState("");
  const [editing, setEditing] = useState<FocusSession | null>(null),
    [editCourse, setEditCourse] = useState(""),
    [editTask, setEditTask] = useState("");
  const [confirmation, setConfirmation] = useState<{
      kind: "discard" | "delete" | "pause" | "finish";
      session: FocusSession;
    } | null>(null),
    [trim, setTrim] = useState("");
  const a = snapshot.active,
    c = a ? focusClock(a, now) : null,
    archived = !!semester.archived_at,
    same = a?.semester_id === semester.id;
  const execute = async (
    s: FocusSession,
    operation: FocusCommand["operation"],
    payload: FocusCommand["payload"] = {},
  ) => {
    const ok = await run({
      id: s.id,
      semester: s.semester_id,
      revision: s.revision,
      operation,
      payload,
    });
    if (ok) {
      setConfirmation(null);
      setEditing(null);
      const title =
        operation === "finish"
          ? "Focus session saved"
          : operation === "discard"
            ? "Session discarded"
            : operation === "delete"
              ? "Session deleted"
              : operation === "associate"
                ? "Association updated"
                : "";
      if (title)
        notify({
          title,
          detail:
            operation === "associate"
              ? undefined
              : s.task_label || s.course_label,
        });
    }
  };
  function transition(kind: "pause" | "finish") {
    if (!a || !c) return;
    if (
      a.mode === "stopwatch" &&
      c.state === "running" &&
      c.elapsed >= 3600000
    ) {
      setTrim("");
      setConfirmation({ kind, session: a });
    } else void execute(a, kind);
  }
  async function start(e: FormEvent) {
    e.preventDefault();

    startId.current ??= crypto.randomUUID();
    const saved = await run({
      id: startId.current,
      semester: semester.id,
      revision: 0,
      operation: "start",
      payload: {
        mode,
        focus_seconds: Number(focusMinutes) * 60,
        break_seconds: Number(breakMinutes) * 60,
        course_id: course,
        task_id: task,
      },
    });
    if (saved) startId.current = null;
  }
  return (
    <div className="focus-workspace">
      <div className="focus-today">
        <span>
          Focused today <strong>{durationLabel(snapshot.today_ms)}</strong>
        </span>
        <span>
          {snapshot.today_sessions}{" "}
          {snapshot.today_sessions === 1 ? "session" : "sessions"} · Completed
          study time · {zone}
        </span>
      </div>
      {error && (
        <div className="form-message form-error" role="alert">
          {error}{" "}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh Focus
          </Button>
        </div>
      )}
      {busy && (
        <p className="field-help" role="status">
          Saving Focus…
        </p>
      )}
      <section className="focus-stage" aria-label="Study timer">
        {a && c ? (
          <>
            <div className="focus-stage-heading">
              <span className="eyebrow">
                {a.mode === "stopwatch" ? "Free focus" : "Pomodoro"}
              </span>
              <span className="focus-state">
                {c.state === "ready"
                  ? "Ready for next focus"
                  : c.state === "paused"
                    ? `Paused · ${c.phase}`
                    : c.phase === "break"
                      ? "Break"
                      : "Focusing"}
              </span>
            </div>
            <div
              className="focus-clock"
              role="timer"
              aria-label={
                a.mode === "stopwatch" ? "Elapsed focus time" : "Time remaining"
              }
            >
              {timerLabel(
                a.mode === "stopwatch" ? c.focused : c.remaining,
                a.mode === "pomodoro",
              )}
            </div>
            {a.mode === "pomodoro" && (
              <p className="focus-accounting">
                {durationLabel(c.focused)} focused · {a.focus_seconds / 60} min
                focus / {a.break_seconds / 60} min break
              </p>
            )}
            <p className="focus-association">
              {[a.course_label, a.task_label].filter(Boolean).join(" / ") ||
                "No course or task"}
            </p>
            {!same ? (
              <p className="field-help">
                This session belongs to{" "}
                {semesters.find((s) => s.id === a.semester_id)?.name ??
                  "another semester"}
                . Select that semester to manage it.
              </p>
            ) : (
              <>
                <div className="focus-controls">
                  {c.state === "running" && (
                    <Button
                      disabled={busy || archived}
                      onClick={() => transition("pause")}
                    >
                      <Pause size={16} /> Pause
                    </Button>
                  )}
                  {c.state === "paused" && (
                    <Button
                      variant="primary"
                      disabled={busy || archived}
                      onClick={() => void execute(a, "resume")}
                    >
                      <Play size={16} /> Resume
                    </Button>
                  )}
                  {(c.phase === "break" || c.state === "ready") && (
                    <Button
                      variant="primary"
                      disabled={busy || archived}
                      onClick={() => void execute(a, "next")}
                    >
                      {c.phase === "break" ? "Skip break" : "Start next focus"}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    disabled={busy || archived}
                    onClick={() => transition("finish")}
                  >
                    <Square size={14} /> Finish session
                  </Button>
                </div>
                <div className="focus-secondary">
                  <Button
                    variant="ghost"
                    disabled={busy || archived}
                    onClick={() => {
                      setEditing(a);
                      setEditCourse(a.course_id ?? "");
                      setEditTask(a.task_id ?? "");
                    }}
                  >
                    Change association
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || archived}
                    onClick={() =>
                      setConfirmation({ kind: "discard", session: a })
                    }
                  >
                    Discard session
                  </Button>
                </div>
              </>
            )}
            {a.mode === "pomodoro" && (
              <p className="field-help">
                Breaks are excluded. The next focus interval starts only when
                you choose.
              </p>
            )}
          </>
        ) : archived ? (
          <p className="task-empty">
            Archived semester · Focus history is read-only.
          </p>
        ) : (
          <>
            <div className="focus-modes" role="group" aria-label="Focus mode">
              <Button
                aria-pressed={mode === "stopwatch"}
                onClick={() => setMode("stopwatch")}
              >
                Free focus
              </Button>
              <Button
                aria-pressed={mode === "pomodoro"}
                onClick={() => setMode("pomodoro")}
              >
                Pomodoro
              </Button>
            </div>
            <div className="focus-clock" aria-label="Timer ready">
              {mode === "stopwatch"
                ? "00:00"
                : timerLabel(Number(focusMinutes) * 60000, true)}
            </div>
            <form className="orbit-form focus-setup" onSubmit={start}>
              <fieldset disabled={busy}>
                {mode === "pomodoro" && (
                  <div className="form-row">
                    <label>
                      Focus minutes
                      <input
                        type="number"
                        required
                        min="1"
                        max="180"
                        step="1"
                        value={focusMinutes}
                        onChange={(e) => setFocusMinutes(e.target.value)}
                      />
                    </label>
                    <label>
                      Break minutes
                      <input
                        type="number"
                        required
                        min="1"
                        max="60"
                        step="1"
                        value={breakMinutes}
                        onChange={(e) => setBreakMinutes(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <Association
                  courses={courses}
                  tasks={tasks}
                  course={course}
                  task={task}
                  onCourse={setCourse}
                  onTask={setTask}
                />
                <Button type="submit" variant="primary">
                  <Play size={16} /> Start focus
                </Button>
              </fieldset>
            </form>
          </>
        )}
      </section>
      <section className="focus-history" aria-label="Recent focus sessions">
        <div className="task-heading">
          <h2>Recent sessions</h2>
          <span className="field-help">Latest 20</span>
        </div>
        {!snapshot.recent.length ? (
          <p className="task-empty">No completed sessions in this semester.</p>
        ) : (
          <ul>
            {snapshot.recent.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{durationLabel(s.focused_ms)}</strong>
                  <span>
                    {s.mode === "stopwatch" ? "Free focus" : "Pomodoro"}
                  </span>
                </div>
                <div>
                  <span>
                    {[s.course_label, s.task_label]
                      .filter(Boolean)
                      .join(" / ") || "Unassigned"}
                  </span>
                  <small>
                    {DateTime.fromISO(s.ended_at!)
                      .setZone(zone)
                      .toFormat("ccc, d LLL · HH:mm")}
                  </small>
                </div>
                {!archived && (
                  <Button
                    variant="ghost"
                    aria-label={`Delete session from ${DateTime.fromISO(s.ended_at!).setZone(zone).toFormat("d LLL HH:mm")}`}
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({ kind: "delete", session: s })
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing && (
        <EditorDialog
          title="Session association"
          onClose={() => !busy && setEditing(null)}
        >
          <p>
            Applies to this whole session. Tasks are not completed
            automatically.
          </p>
          <form
            className="orbit-form"
            onSubmit={(e) => {
              e.preventDefault();
              void execute(editing, "associate", {
                course_id: editCourse,
                task_id: editTask,
              });
            }}
          >
            <fieldset disabled={busy}>
              <Association
                courses={courses}
                tasks={tasks}
                course={editCourse}
                task={editTask}
                onCourse={setEditCourse}
                onTask={setEditTask}
              />
              {error && (
                <p role="alert" className="form-message form-error">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary">
                Save association
              </Button>
            </fieldset>
          </form>
        </EditorDialog>
      )}
      {confirmation && (
        <EditorDialog
          title={
            confirmation.kind === "discard"
              ? "Discard session?"
              : confirmation.kind === "delete"
                ? "Delete saved session?"
                : "Review elapsed time"
          }
          onClose={() => !busy && setConfirmation(null)}
        >
          {confirmation.kind === "discard" || confirmation.kind === "delete" ? (
            <>
              <p>
                {confirmation.kind === "discard"
                  ? "This session and its study time will not be saved."
                  : "Remove this session and its study time from your history and totals?"}
              </p>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void execute(confirmation.session, confirmation.kind)
                }
              >
                {confirmation.kind === "discard"
                  ? "Discard session"
                  : "Delete session"}
              </Button>
            </>
          ) : (
            <>
              <p>
                This focus interval has run for over an hour, including time
                while away. Keep it all, or retain fewer minutes from this
                interval.
              </p>
              <form
                className="orbit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void execute(
                    confirmation.session,
                    confirmation.kind,
                    trim === ""
                      ? {}
                      : { trim_ms: Math.round(Number(trim) * 60000) },
                  );
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    Minutes to retain (optional)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      max={
                        Math.floor(
                          focusClock(confirmation.session, now).elapsed / 6000,
                        ) / 10
                      }
                      value={trim}
                      onChange={(e) => setTrim(e.target.value)}
                      placeholder="Keep all elapsed time"
                    />
                  </label>
                  <Button type="submit" variant="primary">
                    {confirmation.kind === "finish"
                      ? "Confirm and finish"
                      : "Confirm and pause"}
                  </Button>
                </fieldset>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="form-message form-error">
              {error}
            </p>
          )}
        </EditorDialog>
      )}
    </div>
  );
}
