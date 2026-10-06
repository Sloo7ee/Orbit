import { DateTime } from "luxon";
import type { CalendarItem } from "./recurrence";
import type { Task } from "./tasks";
import type { Assessment } from "./grades";
export function focusWeek(zone: string, now = new Date()) {
  const local = DateTime.fromJSDate(now, { zone });
  const start = local.startOf("day").minus({ days: local.weekday % 7 });
  return {
    start: start.toUTC().toISO()!,
    end: start.plus({ days: 7 }).toUTC().toISO()!,
    days: Array.from({ length: 7 }, (_, i) => ({
      date: start.plus({ days: i }).toISODate()!,
      label: start.plus({ days: i }).toFormat("ccc"),
      milliseconds: 0,
    })),
  };
}
export function weeklyFocus(
  intervals: { started_at: string; ended_at: string }[],
  zone: string,
  now = new Date(),
) {
  const week = focusWeek(zone, now);
  return week.days.map((day) => {
    const start = DateTime.fromISO(day.date, { zone }),
      end = start.plus({ days: 1 });
    return {
      ...day,
      milliseconds: intervals.reduce(
        (sum, i) =>
          sum +
          Math.max(
            0,
            Math.min(Date.parse(i.ended_at), end.toMillis(), now.getTime()) -
              Math.max(Date.parse(i.started_at), start.toMillis()),
          ),
        0,
      ),
    };
  });
}
export type NextItem = {
  id: string;
  kind: "Class" | "Event" | "Task" | "Assessment";
  title: string;
  date: string;
  time: string | null;
  instant: number;
  record: CalendarItem | Task | Assessment;
};
export function nextItems(
  events: CalendarItem[],
  tasks: Task[],
  assessments: Assessment[],
  zone: string,
  now = new Date(),
): NextItem[] {
  const today = DateTime.fromJSDate(now, { zone }).toISODate()!;
  const deadlines = (
    rows: (Task | Assessment)[],
    kind: "Task" | "Assessment",
  ): NextItem[] =>
    rows
      .filter(
        (r) =>
          !("completed_at" in r && r.completed_at) &&
          r.due_date &&
          r.due_date >= today,
      )
      .map((r) => ({
        id: r.id,
        kind,
        title: "title" in r ? r.title : r.name,
        date: r.due_date!,
        time: r.due_time,
        instant: DateTime.fromISO(`${r.due_date}T${r.due_time ?? "23:59:59"}`, {
          zone,
        }).toMillis(),
        record: r,
      }));
  return [
    ...events.map((e) => {
      const d = DateTime.fromISO(e.starts_at).setZone(zone);
      return {
        id: e.id,
        kind: e.recurring ? ("Class" as const) : ("Event" as const),
        title: e.title,
        date: d.toISODate()!,
        time: d.toFormat("HH:mm"),
        instant: d.toMillis(),
        record: e,
      };
    }),
    ...deadlines(tasks, "Task"),
    ...deadlines(assessments, "Assessment"),
  ]
    .filter((e) => e.instant >= now.getTime())
    .sort((a, b) => a.instant - b.instant || a.id.localeCompare(b.id))
    .slice(0, 4);
}
