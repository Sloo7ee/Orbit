"use client";
import { useActionNotification } from "@/components/ui/action-notifications";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button, Surface } from "@/components/ui/primitives";
import { TaskEditor } from "./task-editor";
import { changeTask } from "@/lib/actions/tasks";
import {
  sections,
  sortTasks,
  taskSection,
  taskDueLabel,
  type Task,
} from "@/lib/domain/tasks";
import type { Course, Semester } from "@/lib/supabase/database.types";
export function TaskList({
  tasks,
  courses,
  semester,
  zone,
  compact = false,
  onUpdated,
}: {
  tasks: Task[];
  courses: Course[];
  semester: Semester;
  zone: string;
  compact?: boolean;
  onUpdated?: () => void;
}) {
  const notify = useActionNotification();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [editor, setEditor] = useState<Partial<Task> | null>(null);
  const [course, setCourse] = useState("all"),
    [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [overrides, setOverrides] = useState<
    Record<
      string,
      { base: number; completed_at: string | null; revision: number }
    >
  >({});
  const [pending, setPending] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const archived = !!semester.archived_at;
  const rows = tasks.map((t) =>
    overrides[t.id]?.base === t.revision ? { ...t, ...overrides[t.id] } : t,
  );
  const relevant = sortTasks(
    rows.filter(
      (t) =>
        (course === "all" ||
          (course === "none" ? !t.course_id : t.course_id === course)) &&
        (status === "all" ||
          (status === "completed" ? !!t.completed_at : !t.completed_at)),
    ),
    zone,
  );
  const refreshed = () => {
    startRefresh(() => {
      router.refresh();
      onUpdated?.();
    });
  };
  async function toggle(task: Task) {
    if (pending || archived) return;
    setPending(task.id);
    setError("");

    const original = overrides[task.id];
    const completed = !task.completed_at;
    setOverrides((v) => ({
      ...v,
      [task.id]: {
        base: tasks.find((t) => t.id === task.id)!.revision,
        revision: task.revision,
        completed_at: completed ? new Date().toISOString() : null,
      },
    }));
    const f = new FormData();
    Object.entries({
      id: task.id,
      semester_id: semester.id,
      revision: String(task.revision),
      request_id: crypto.randomUUID(),
      operation: "complete",
      completed: String(completed),
    }).forEach(([k, v]) => f.set(k, v));
    try {
      const result = await changeTask(f);
      if (result.error) throw new Error(result.error);
      setOverrides((v) => ({
        ...v,
        [task.id]: { ...v[task.id], revision: result.revision! },
      }));
      notify({
        title: completed ? "Task completed" : "Task reopened",
        detail: task.title,
      });
      refreshed();
    } catch (e) {
      setOverrides((v) => {
        const next = { ...v };
        if (original) next[task.id] = original;
        else delete next[task.id];
        return next;
      });
      setError(
        e instanceof Error ? e.message : "Could not update task. Try again.",
      );
    } finally {
      setPending(null);
    }
  }
  function row(task: Task) {
    return (
      <div
        className={`task-row ${task.completed_at ? "task-completed" : ""}`}
        key={task.id}
      >
        <button
          className="task-check"
          aria-label={`${task.completed_at ? "Reopen" : "Complete"} ${task.title}`}
          aria-pressed={!!task.completed_at}
          disabled={archived || !!pending || refreshing}
          onClick={() => toggle(task)}
        >
          {task.completed_at && <Check size={13} />}
        </button>
        <button
          className="task-details"
          onClick={() => setEditor(task)}
          disabled={pending === task.id || refreshing}
        >
          <strong>{task.title}</strong>
          <small>
            {taskDueLabel(task)}
            {task.course_id
              ? ` · ${courses.find((c) => c.id === task.course_id)?.code ?? ""}`
              : ""}
          </small>
        </button>
        {!compact && (
          <span className={`task-priority priority-${task.priority}`}>
            {task.priority}
          </span>
        )}
      </div>
    );
  }
  const content = (
    <>
      <div className="task-heading">
        <h2>{compact ? "To-do" : "Tasks"}</h2>
        {compact ? (
          <Link href="/todo">View all</Link>
        ) : (
          !archived && (
            <Button variant="primary" onClick={() => setEditor({})}>
              <Plus size={15} /> New task
            </Button>
          )
        )}
      </div>
      {!compact && (
        <div className="task-filters">
          <label>
            Course filter
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="all">All courses</option>
              <option value="none">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status filter
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All tasks</option>
              <option value="incomplete">Incomplete</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {compact ? (
        archived ? (
          <p className="field-help">
            Archived semester · <Link href="/todo">View task history</Link>
          </p>
        ) : (
          <>
            {relevant
              .filter((t) => !t.completed_at)
              .slice(0, 3)
              .map(row)}
            {!relevant.some((t) => !t.completed_at) && (
              <p className="field-help">No incomplete tasks.</p>
            )}
          </>
        )
      ) : (
        <>
          {archived && (
            <p className="field-help">Archived semester · Read only</p>
          )}
          {!relevant.length && (
            <p className="task-empty">
              {tasks.length ? "No tasks match these filters." : "No tasks yet."}
            </p>
          )}
          {sections.map((section) => {
            const group = relevant.filter(
              (t) => taskSection(t, zone) === section,
            );
            return group.length ? (
              <section
                className="task-section"
                key={section}
                aria-label={section}
              >
                <h3>
                  {section} <span>{group.length}</span>
                </h3>
                {group.map(row)}
              </section>
            ) : null;
          })}
        </>
      )}
      {editor && (
        <TaskEditor
          task={editor}
          courses={courses}
          semester={semester.id}
          zone={zone}
          readOnly={archived}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);

            refreshed();
          }}
        />
      )}
    </>
  );
  return compact ? (
    <Surface className="task-summary">{content}</Surface>
  ) : (
    <div className="task-workspace">{content}</div>
  );
}
