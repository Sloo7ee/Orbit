"use client";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { useState } from "react";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/primitives";
import { changeTask } from "@/lib/actions/tasks";
import { taskDueLabel, type Task } from "@/lib/domain/tasks";
import type { Course } from "@/lib/supabase/database.types";
export function TaskEditor({
  task,
  courses,
  semester,
  zone,
  readOnly,
  onClose,
  onSaved,
}: {
  task: Partial<Task>;
  courses: Course[];
  semester: string;
  zone: string;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [request] = useState(() => crypto.randomUUID());
  const [id] = useState(() => task.id ?? crypto.randomUUID());
  const [date, setDate] = useState(task.due_date ?? "");
  const [time, setTime] = useState(task.due_time?.slice(0, 5) ?? "");
  return (
    <EditorDialog
      title={
        deleting ? "Delete task?" : task.revision ? "Task details" : "New task"
      }
      onClose={onClose}
    >
      {readOnly ? (
        <div>
          <h3>{task.title}</h3>
          <p className="task-description">{task.description}</p>
          <p>
            {taskDueLabel(task as Task)} · {task.priority} priority
          </p>
          <p>
            {task.completed_at ? "Completed" : "Incomplete"} · Archived semester
            · Read only
          </p>
        </div>
      ) : (
        <>
          {deleting && (
            <p>
              Permanently delete “{task.title}”? Its completion history will
              also be removed.
            </p>
          )}
          <ActionForm
            key={String(deleting)}
            successMessage={
              deleting
                ? "Task deleted"
                : task.revision
                  ? "Task updated"
                  : "Task added"
            }
            successDetail={deleting ? task.title : undefined}
            action={changeTask}
            revision={task.revision ?? 0}
            submitLabel={deleting ? "Delete task" : "Save task"}
            onSuccess={onSaved}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="semester_id" value={semester} />
            <input type="hidden" name="request_id" value={request} />
            <input
              type="hidden"
              name="operation"
              value={deleting ? "delete" : "save"}
            />
            {!deleting && (
              <>
                <label>
                  Title
                  <input
                    name="title"
                    required
                    maxLength={160}
                    defaultValue={task.title}
                  />
                </label>
                <label>
                  Description (optional)
                  <textarea
                    name="description"
                    rows={3}
                    maxLength={4000}
                    defaultValue={task.description}
                  />
                </label>
                <div className="form-row">
                  <DatePicker
                    label="Due date"
                    zone={zone}
                    name="due_date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={date}
                    onValueChange={(value) => {
                      setDate(value);
                      if (!value) setTime("");
                    }}
                  />
                  <div>
                    <TimePicker
                      label="Due time"
                      name="due_time"
                      disabled={!date}
                      value={time}
                      onValueChange={(value) => setTime(value)}
                    />
                    {time && date && (
                      <Button variant="ghost" onClick={() => setTime("")}>
                        Remove due time
                      </Button>
                    )}
                  </div>
                </div>
                {!date && <input type="hidden" name="due_time" value="" />}
                <p className="field-help" id="task-due-time-help">
                  {date
                    ? "Optional time. Type HH:mm or use the clock."
                    : "Choose a due date to add a time."}{" "}
                  {zone} · Without a time, due by the end of the day.
                </p>
                <div className="form-row">
                  <label>
                    Course
                    <select
                      name="course_id"
                      defaultValue={task.course_id ?? ""}
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
                    Priority
                    <select
                      name="priority"
                      defaultValue={task.priority ?? "medium"}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
              </>
            )}
          </ActionForm>
          {task.revision && !deleting && (
            <ActionForm
              action={changeTask}
              revision={task.revision}

              successMessage={
                task.completed_at ? "Task reopened" : "Task completed"
              }
              successDetail={task.title}
              submitLabel={
                task.completed_at ? "Mark incomplete" : "Mark complete"
              }
              onSuccess={onSaved}
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="semester_id" value={semester} />
              <input type="hidden" name="request_id" value={request} />
              <input type="hidden" name="operation" value="complete" />
              <input
                type="hidden"
                name="completed"
                value={String(!task.completed_at)}
              />
            </ActionForm>
          )}
          {task.revision && (
            <Button variant="ghost" onClick={() => setDeleting(!deleting)}>
              {deleting ? "Keep task" : "Delete task"}
            </Button>
          )}
        </>
      )}
    </EditorDialog>
  );
}
