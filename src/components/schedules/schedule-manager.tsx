"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/primitives";
import { ScheduleEditor } from "./schedule-editor";
import {
  firstMeeting,
  weekdayNames,
  type CalendarItem,
} from "@/lib/domain/recurrence";
import type {
  Course,
  CourseSchedule,
  Semester,
} from "@/lib/supabase/database.types";
export function ScheduleManager({
  course,
  schedules,
  semester,
  zone,
}: {
  course: Course;
  schedules: CourseSchedule[];
  semester: Semester;
  zone: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<
    { meeting?: CalendarItem; block?: CourseSchedule } | null | undefined
  >(undefined);
  return (
    <div className="course-schedules">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open
          ? "Hide schedule"
          : `Schedule${schedules.length ? ` · ${schedules.length} blocks` : ""}`}
      </Button>
      {open && (
        <div className="schedule-list" aria-label={`${course.code} schedule`}>
          {!schedules.length && (
            <p className="field-help">No weekly meetings yet.</p>
          )}
          {schedules.map((s) => (
            <div key={s.id} className="schedule-row">
              <div>
                <strong>
                  {s.weekdays
                    .map((d) => weekdayNames[d].slice(0, 3))
                    .join(" · ")}{" "}
                  · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </strong>
                <p>
                  {s.location && `${s.location} · `}
                  {s.effective_start} – {s.effective_end}
                </p>
                <small>{s.timezone}</small>
              </div>
              <Button
                onClick={() =>
                  setEditing({
                    block: s,
                    meeting: semester.archived_at
                      ? undefined
                      : (firstMeeting(
                          s,
                          DateTime.now().setZone(s.timezone).toISODate()!,
                          course,
                        ) ??
                        firstMeeting(s, s.effective_start, course) ??
                        undefined),
                  })
                }
              >
                {semester.archived_at ? "View schedule" : "Edit meetings"}
              </Button>
            </div>
          ))}
          {!semester.archived_at && (
            <Button onClick={() => setEditing(null)}>
              Add weekly schedule
            </Button>
          )}
        </div>
      )}
      {editing !== undefined && (
        <ScheduleEditor
          course={course}
          semester={semester}
          zone={zone}
          meeting={editing?.meeting}
          block={editing?.block}
          initialScope={editing?.meeting ? "future" : "all"}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}
