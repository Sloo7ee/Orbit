import { DateTime } from "luxon";
import { z } from "zod";
import { wallTime } from "./calendar";
import type {
  CalendarEvent,
  Course,
  CourseSchedule,
  ScheduleException,
} from "@/lib/supabase/database.types";
export type CalendarItem = CalendarEvent & {
  location?: string;
  recurring?: { schedule: CourseSchedule; original_date: string };
};
export const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const scheduleFields = z
  .object({
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    location: z.string().trim().max(200),
    effective_start: z.iso.date(),
    effective_end: z.iso.date(),
  })
  .refine((v) => v.end_time !== v.start_time, {
    message: "Start and end times must differ.",
  })
  .refine((v) => v.effective_end >= v.effective_start, {
    message: "End date must follow start date.",
  });
export function meetingOn(
  schedule: CourseSchedule,
  date: string,
  course?: Course,
): CalendarItem | null {
  if (
    schedule.deleted ||
    date < schedule.effective_start ||
    date > schedule.effective_end
  )
    return null;
  const day = DateTime.fromISO(date, { zone: schedule.timezone });
  if (!schedule.weekdays.includes(day.weekday % 7)) return null;
  try {
    const starts_at = wallTime(
      `${date}T${schedule.start_time.slice(0, 5)}`,
      schedule.timezone,
    );
    const endDate =
      schedule.end_time < schedule.start_time
        ? day.plus({ days: 1 }).toISODate()!
        : date;
    const ends_at = wallTime(
      `${endDate}T${schedule.end_time.slice(0, 5)}`,
      schedule.timezone,
    );
    if (Date.parse(ends_at) <= Date.parse(starts_at)) return null;
    return {
      id: `${schedule.id}:${date}`,
      owner_id: schedule.owner_id,
      semester_id: schedule.semester_id,
      course_id: schedule.course_id,
      title: course?.name ?? schedule.title,
      color: course?.color ?? schedule.color,
      revision: schedule.revision,
      starts_at,
      ends_at,
      location: schedule.location,
      recurring: { schedule, original_date: date },
    };
  } catch {
    return null;
  }
}
// Iterate local calendar days only inside the requested window, plus one day
// for overnight classes. Exceptions are keyed by original date, never moved date.
export function expandSchedules(
  schedules: CourseSchedule[],
  exceptions: ScheduleException[],
  courses: Course[],
  start: string,
  end: string,
) {
  const from = Date.parse(start),
    until = Date.parse(end);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(until) ||
    until <= from ||
    until - from > 62 * 86400000
  )
    throw new Error("Invalid calendar range.");
  const result: CalendarItem[] = [];
  let skipped = 0;
  const overrides = new Map(
    exceptions.map((e) => [`${e.schedule_id}:${e.original_date}`, e]),
  );
  const overlaps = (e: CalendarItem) =>
    Date.parse(e.starts_at) < until && Date.parse(e.ends_at) > from;
  for (const schedule of schedules) {
    if (schedule.deleted) continue;
    const course = courses.find((c) => c.id === schedule.course_id);
    let date = DateTime.fromMillis(from, { zone: schedule.timezone })
      .startOf("day")
      .minus({ days: 1 });
    const stop = DateTime.fromMillis(until, {
      zone: schedule.timezone,
    }).startOf("day");
    if (date.toISODate()! < schedule.effective_start)
      date = DateTime.fromISO(schedule.effective_start, {
        zone: schedule.timezone,
      });
    for (
      ;
      date <= stop && date.toISODate()! <= schedule.effective_end;
      date = date.plus({ days: 1 })
    ) {
      const original = date.toISODate()!;
      if (!schedule.weekdays.includes(date.weekday % 7)) continue;
      if (overrides.has(`${schedule.id}:${original}`)) continue;
      const event = meetingOn(schedule, original, course);
      if (event && overlaps(event)) result.push(event);
      else if (!event) skipped++;
    }
    // A replacement may come from an original occurrence outside the requested range.
    for (const exception of exceptions) {
      if (
        exception.schedule_id !== schedule.id ||
        exception.cancelled ||
        !exception.starts_at ||
        !exception.ends_at
      )
        continue;
      if (
        exception.original_date < schedule.effective_start ||
        exception.original_date > schedule.effective_end
      )
        continue;
      const original = meetingOn(schedule, exception.original_date, course);
      if (!original) continue;
      const event = {
        ...original,
        starts_at: exception.starts_at,
        ends_at: exception.ends_at,
        location: exception.location,
      };
      if (overlaps(event)) result.push(event);
    }
    if (result.length > 2000)
      throw new Error("Too many meetings. Choose a smaller calendar view.");
  }
  return {
    events: result.sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    ),
    skipped,
  };
}
export function firstMeeting(
  schedule: CourseSchedule,
  after: string,
  course?: Course,
): CalendarItem | null {
  const start =
    after > schedule.effective_start ? after : schedule.effective_start;
  for (let i = 0; i < 15; i++) {
    const d = DateTime.fromISO(start, { zone: schedule.timezone })
      .plus({ days: i })
      .toISODate()!;
    const event = meetingOn(schedule, d, course);
    if (event) return event;
  }
  return null;
}

// Find only the next few meetings per block. Cancelled/moved originals are
// skipped without materializing the semester, even for distant future terms.
export function upcomingMeetings(
  schedules: CourseSchedule[],
  exceptions: ScheduleException[],
  courses: Course[],
  now: string,
): CalendarItem[] {
  const instant = Date.parse(now);
  if (!Number.isFinite(instant)) throw new Error("Invalid date.");
  const result: CalendarItem[] = [];
  for (const schedule of schedules) {
    if (schedule.deleted) continue;
    const course = courses.find((c) => c.id === schedule.course_id);
    const overrides = exceptions.filter((e) => e.schedule_id === schedule.id);
    const dates = new Set(overrides.map((e) => e.original_date));
    for (const e of overrides) {
      if (
        e.cancelled ||
        !e.starts_at ||
        !e.ends_at ||
        Date.parse(e.starts_at) < instant
      )
        continue;
      const original = meetingOn(schedule, e.original_date, course);
      if (original)
        result.push({
          ...original,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          location: e.location,
        });
    }
    let date = DateTime.fromMillis(instant, {
      zone: schedule.timezone,
    }).toISODate()!;
    let found = 0;
    for (let tries = 0; tries < overrides.length + 5 && found < 3; tries++) {
      const event = firstMeeting(schedule, date, course);
      if (!event) break;
      const original = event.recurring!.original_date;
      date = DateTime.fromISO(original, { zone: schedule.timezone })
        .plus({ days: 1 })
        .toISODate()!;
      if (dates.has(original) || Date.parse(event.starts_at) < instant)
        continue;
      result.push(event);
      found++;
    }
  }
  return result
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, 3);
}
