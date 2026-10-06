import { z } from "zod";
import { DateTime } from "luxon";
import { wallTime } from "./calendar";
import type { Database } from "../supabase/database.types";
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        v >= "1900-01-01" &&
        DateTime.fromISO(v).isValid),
  );
export const taskFields = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().max(4000),
    due_date: date,
    due_time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
    course_id: z.union([z.uuid(), z.literal("")]),
    priority: z.enum(["low", "medium", "high"]),
  })
  .refine((v) => !v.due_time || !!v.due_date, {
    message: "Choose a due date before a due time.",
  });
export const sections = [
  "Overdue",
  "Today",
  "Upcoming",
  "No due date",
  "Completed",
] as const;
export function taskSection(
  task: Task,
  zone: string,
  now: DateTime = DateTime.now(),
): (typeof sections)[number] {
  if (task.completed_at) return "Completed";
  if (!task.due_date) return "No due date";
  const today = now.setZone(zone).toISODate()!;
  if (task.due_date < today) return "Overdue";
  if (task.due_time) {
    try {
      if (
        Date.parse(
          wallTime(`${task.due_date}T${task.due_time.slice(0, 5)}`, zone),
        ) < now.toMillis()
      )
        return "Overdue";
    } catch {
      /* Invalid DST times are due at the next valid local time. */
      if (
        DateTime.fromISO(`${task.due_date}T${task.due_time}`, {
          zone,
        }).toMillis() < now.toMillis()
      )
        return "Overdue";
    }
  }
  return task.due_date === today ? "Today" : "Upcoming";
}
export function sortTasks(
  tasks: Task[],
  zone: string,
  now: DateTime = DateTime.now(),
) {
  const priority = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort(
    (a, b) =>
      sections.indexOf(taskSection(a, zone, now)) -
        sections.indexOf(taskSection(b, zone, now)) ||
      (a.completed_at && b.completed_at
        ? b.completed_at.localeCompare(a.completed_at)
        : (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
          (a.due_time ?? "23:59").localeCompare(b.due_time ?? "23:59") ||
          priority[a.priority as keyof typeof priority] -
            priority[b.priority as keyof typeof priority]) ||
      a.created_at.localeCompare(b.created_at),
  );
}
export function taskDueLabel(task: Task) {
  if (!task.due_date) return "No due date";
  return (
    DateTime.fromISO(task.due_date).toFormat("MMM d, yyyy") +
    (task.due_time ? ` · ${task.due_time.slice(0, 5)}` : "")
  );
}
export function taskCalendarDate(task: Task, zone: string) {
  if (!task.due_date) return null;
  if (!task.due_time) return task.due_date;
  try {
    return wallTime(`${task.due_date}T${task.due_time.slice(0, 5)}`, zone);
  } catch {
    return DateTime.fromISO(`${task.due_date}T${task.due_time}`, {
      zone,
    }).toISO();
  }
}
