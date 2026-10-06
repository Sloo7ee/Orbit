"use client";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ColorPicker } from "@/components/ui/color-picker";
import type { EditorAnchor } from "@/components/ui/editor-dialog";
import { useState } from "react";
import { DateTime } from "luxon";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/primitives";
import { saveEvent, deleteAcademic } from "@/lib/actions/academic";
import { colors, localInput, wallTime } from "@/lib/domain/calendar";
import type { CalendarEvent, Course } from "@/lib/supabase/database.types";
export function EventEditor({
  event,
  anchor,
  courses,
  semester,
  zone,
  readOnly,
  onClose,
  onSaved,
}: {
  event: Partial<CalendarEvent>;
  anchor?: EditorAnchor;
  courses: Course[];
  semester: string;
  zone: string;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [color, setColor] = useState(event.color ?? colors[0]);
  const start =
    event.starts_at ?? DateTime.now().setZone(zone).startOf("hour").toISO()!;
  const end =
    event.ends_at ?? DateTime.fromISO(start).plus({ hours: 1 }).toISO()!;
  return (
    <EditorDialog
      title={
        deleting
          ? "Delete event?"
          : event.revision
            ? "Event details"
            : "New event"
      }
      anchor={anchor}
      onClose={onClose}
    >
      {deleting ? (
        <>
          <p>Permanently delete “{event.title}”?</p>
          <ActionForm
            action={deleteAcademic}
            successMessage="Event deleted"
            successDetail={event.title}
            submitLabel="Delete event"
            onSuccess={onSaved}
          >
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="semester_id" value={semester} />
            <input type="hidden" name="revision" value={event.revision} />
            <input type="hidden" name="kind" value="event" />
          </ActionForm>
          <Button onClick={() => setDeleting(false)}>Keep event</Button>
        </>
      ) : readOnly ? (
        <div className="historical-event">
          <h3>{event.title}</h3>
          <p>
            {DateTime.fromISO(start)
              .setZone(zone)
              .toLocaleString(DateTime.DATETIME_MED)}{" "}
            –{" "}
            {DateTime.fromISO(end)
              .setZone(zone)
              .toLocaleString(DateTime.DATETIME_MED)}
          </p>
          <p>{courses.find((c) => c.id === event.course_id)?.name}</p>
          <p>Archived semester · Read only</p>
        </div>
      ) : (
        <>
          <ActionForm
            action={async (form) => {
              try {
                form.set(
                  "starts_at",
                  wallTime(String(form.get("start")), zone),
                );
                form.set("ends_at", wallTime(String(form.get("end")), zone));
              } catch {
                return {
                  error: "This local time does not exist. Choose another time.",
                };
              }
              return saveEvent(form);
            }}
            revision={event.revision ?? 0}
            submitLabel="Save event"
            successMessage={event.revision ? "Event updated" : "Event added"}
            onSuccess={onSaved}
          >
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="semester_id" value={semester} />
            <label>
              Title
              <input
                name="title"
                required
                maxLength={160}
                defaultValue={event.title}
              />
            </label>
            <DateTimePicker
              label="Start"
              zone={zone}
              name="start"
              required
              defaultValue={localInput(start, zone)}
            />
            <DateTimePicker
              label="End"
              zone={zone}
              name="end"
              required
              defaultValue={localInput(end, zone)}
            />
            <p className="field-help">
              {zone} · End is exclusive. Repeated daylight-saving times use the
              earlier offset.
            </p>
            <label>
              Course
              <select
                name="course_id"
                defaultValue={event.course_id ?? ""}
                onChange={(e) => {
                  const course = courses.find((c) => c.id === e.target.value);
                  if (course) setColor(course.color);
                }}
              >
                <option value="">No course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <ColorPicker
              label="Event color"
              value={color}
              onChange={setColor}
            />
          </ActionForm>
          {!!event.revision && (
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              Delete event
            </Button>
          )}
        </>
      )}
    </EditorDialog>
  );
}
