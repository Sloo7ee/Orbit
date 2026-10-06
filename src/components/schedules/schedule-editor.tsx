"use client";
import {
  DateTimePicker,
  TimePicker,
  DatePicker,
} from "@/components/ui/date-time-picker";
import { useState } from "react";
import { DateTime } from "luxon";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/primitives";
import { changeSchedule } from "@/lib/actions/schedules";
import { localInput, wallTime } from "@/lib/domain/calendar";
import { weekdayNames, type CalendarItem } from "@/lib/domain/recurrence";
import type {
  Course,
  CourseSchedule,
  Semester,
} from "@/lib/supabase/database.types";
export function ScheduleEditor({
  course,
  block,
  semester,
  zone,
  meeting,
  initialScope = "one",
  onClose,
  onSaved,
}: {
  course?: Course;
  block?: CourseSchedule;
  semester: Semester;
  zone: string;
  meeting?: CalendarItem;
  initialScope?: "one" | "future" | "all";
  onClose: () => void;
  onSaved: () => void;
}) {
  const schedule = meeting?.recurring?.schedule ?? block;
  const original = meeting?.recurring?.original_date ?? "";
  const [scope, setScope] = useState(schedule ? initialScope : "create");
  const [deleting, setDeleting] = useState(false);
  const [id] = useState(() => schedule?.id ?? crypto.randomUUID());
  const [request] = useState(() => crypto.randomUUID());
  const timeZone = schedule?.timezone ?? zone;
  const readonly = !!semester.archived_at;
  const proposed = meeting
    ? DateTime.fromISO(meeting.starts_at, { zone: timeZone })
    : null;
  const shift =
    proposed && original
      ? Math.round(
          proposed
            .startOf("day")
            .diff(DateTime.fromISO(original, { zone: timeZone }), "days").days,
        )
      : 0;
  const days = schedule?.weekdays.map(
    (day) => (((day + shift) % 7) + 7) % 7,
  ) ?? [0, 2, 4];
  const effectiveStart =
    scope === "future"
      ? (proposed?.toISODate() ?? original) > original
        ? proposed!.toISODate()!
        : original
      : (schedule?.effective_start ?? semester.start_date);
  return (
    <EditorDialog
      title={
        deleting
          ? "Delete recurring meetings"
          : schedule
            ? "Recurring meeting"
            : "Add weekly schedule"
      }
      onClose={onClose}
    >
      <p>
        {course?.code ? `${course.code} · ` : ""}
        {course?.name ?? schedule?.title}{" "}
        {original &&
          `· Selected meeting: ${DateTime.fromISO(original).toFormat("MMM d, yyyy")}`}
      </p>
      {readonly ? (
        <>
          {meeting ? (
            <p>
              {meeting &&
                DateTime.fromISO(meeting.starts_at)
                  .setZone(timeZone)
                  .toLocaleString(DateTime.DATETIME_MED)}{" "}
              –{" "}
              {meeting &&
                DateTime.fromISO(meeting.ends_at)
                  .setZone(timeZone)
                  .toLocaleString(DateTime.DATETIME_MED)}
            </p>
          ) : (
            <p>
              {schedule?.weekdays.map((d) => weekdayNames[d]).join(", ")} ·{" "}
              {schedule?.start_time.slice(0, 5)}–
              {schedule?.end_time.slice(0, 5)}
              <br />
              {schedule?.effective_start} – {schedule?.effective_end} ·{" "}
              {timeZone}
            </p>
          )}
          <p>{meeting?.location || schedule?.location || "No location"}</p>
          <p>Archived semester · Read only</p>
        </>
      ) : (
        <>
          <ActionForm
            successMessage={
              deleting
                ? "Meetings deleted"
                : schedule
                  ? "Schedule updated"
                  : "Schedule added"
            }
            successDetail={course?.code}
            action={async (form) => {
              if (scope === "one" && !deleting) {
                try {
                  form.set(
                    "starts_at",
                    wallTime(String(form.get("start")), timeZone),
                  );
                  form.set(
                    "ends_at",
                    wallTime(String(form.get("end")), timeZone),
                  );
                } catch {
                  return {
                    error:
                      "This local time does not exist. Choose another time.",
                  };
                }
              }
              return changeSchedule(form);
            }}
            submitLabel={
              deleting
                ? "Delete meetings"
                : schedule
                  ? "Save changes"
                  : "Save schedule"
            }
            onSuccess={onSaved}
            revision={schedule?.revision ?? 0}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="request_id" value={request} />
            <input type="hidden" name="original" value={original} />
            <input type="hidden" name="delete" value={String(deleting)} />
            <input type="hidden" name="course_id" value={course?.id ?? ""} />
            {schedule ? (
              <label>
                Apply to
                <select
                  name="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  {original && <option value="one">This event only</option>}
                  {original && (
                    <option value="future">This and future events</option>
                  )}
                  <option value="all">Entire series</option>
                </select>
              </label>
            ) : (
              <input type="hidden" name="scope" value="create" />
            )}
            {!deleting &&
              (scope === "one" ? (
                <div key="one" className="schedule-fields">
                  <DateTimePicker
                    label="Start"
                    zone={timeZone}
                    name="start"
                    required
                    defaultValue={localInput(meeting!.starts_at, timeZone)}
                  />
                  <DateTimePicker
                    label="End"
                    zone={timeZone}
                    name="end"
                    required
                    defaultValue={localInput(meeting!.ends_at, timeZone)}
                  />
                  <label>
                    Location (optional)
                    <input
                      name="location"
                      maxLength={200}
                      defaultValue={meeting?.location ?? ""}
                    />
                  </label>
                </div>
              ) : (
                <div key={scope} className="schedule-fields">
                  <fieldset className="weekday-picker">
                    <legend>Repeat weekly on</legend>
                    <div className="weekday-options">
                      {weekdayNames.map((day, i) => (
                        <label key={day}>
                          <input
                            type="checkbox"
                            aria-label={day}
                            name="weekday"
                            value={i}
                            defaultChecked={days.includes(i)}
                          />
                          <span>{day.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="form-row">
                    <TimePicker
                      label="Start time"
                      name="start_time"
                      required
                      defaultValue={
                        proposed?.toFormat("HH:mm") ??
                        schedule?.start_time.slice(0, 5) ??
                        "09:00"
                      }
                    />
                    <TimePicker
                      label="End time"
                      name="end_time"
                      required
                      defaultValue={
                        meeting
                          ? DateTime.fromISO(meeting.ends_at, {
                              zone: timeZone,
                            }).toFormat("HH:mm")
                          : (schedule?.end_time.slice(0, 5) ?? "10:00")
                      }
                    />
                  </div>
                  <label>
                    Location (optional)
                    <input
                      name="location"
                      maxLength={200}
                      defaultValue={
                        meeting?.location ?? schedule?.location ?? ""
                      }
                    />
                  </label>
                  <div className="form-row">
                    <DatePicker
                      label="Effective start date"
                      zone={timeZone}
                      name="effective_start"
                      required
                      min={scope === "future" ? original : semester.start_date}
                      max={semester.end_date}
                      defaultValue={effectiveStart}
                    />
                    <DatePicker
                      label="Effective end date"
                      zone={timeZone}
                      name="effective_end"
                      required
                      min={semester.start_date}
                      max={semester.end_date}
                      defaultValue={
                        schedule?.effective_end ?? semester.end_date
                      }
                    />
                  </div>
                  <p className="field-help">
                    Times in {timeZone}. An end time earlier than the start ends
                    the next day.
                  </p>
                </div>
              ))}
            {scope !== "one" && scope !== "create" && (
              <div className="scope-confirmation" key={`${scope}-${deleting}`}>
                <p>
                  {scope === "future"
                    ? `Meetings before the original ${original} meeting stay unchanged. This creates a separate block for future meetings.`
                    : `This affects every meeting in this block (${schedule?.effective_start} – ${schedule?.effective_end}), including past meetings. Blocks separated by earlier future edits stay unchanged.`}
                </p>
                <label className="check-label">
                  <input type="checkbox" name="confirm_reset" required />
                  {deleting
                    ? "Delete all meetings and individual changes in this scope."
                    : "Apply this schedule and reset individual changes and cancellations in this scope."}
                </label>
              </div>
            )}
            {deleting && scope === "one" && (
              <p>
                Only this meeting will be removed. The weekly schedule will stay
                unchanged.
              </p>
            )}
          </ActionForm>
          {schedule && (
            <Button variant="ghost" onClick={() => setDeleting(!deleting)}>
              {deleting ? "Keep meetings" : "Delete recurring meeting"}
            </Button>
          )}
        </>
      )}
    </EditorDialog>
  );
}
