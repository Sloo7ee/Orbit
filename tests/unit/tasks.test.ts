import { it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  taskFields,
  taskSection,
  sortTasks,
  taskCalendarDate,
  type Task,
} from "../../src/lib/domain/tasks";
const task = (v: Partial<Task> = {}): Task => ({
  id: "a",
  owner_id: "b",
  semester_id: "c",
  course_id: null,
  title: "Read",
  description: "",
  due_date: null,
  due_time: null,
  priority: "medium",
  completed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  revision: 1,
  ...v,
});
const now = DateTime.fromISO("2026-10-04T12:00:00+03:00");
it("date-only deadlines remain Today until the next local day", () => {
  expect(
    taskSection(task({ due_date: "2026-10-04" }), "Asia/Riyadh", now),
  ).toBe("Today");
  expect(
    taskSection(task({ due_date: "2026-10-03" }), "Asia/Riyadh", now),
  ).toBe("Overdue");
  expect(
    taskSection(
      task({ due_date: "2026-10-04" }),
      "Asia/Riyadh",
      DateTime.fromISO("2026-10-04T21:00:00Z"),
    ),
  ).toBe("Overdue");
});
it("timed deadlines use profile timezone and completion takes precedence", () => {
  expect(
    taskSection(
      task({ due_date: "2026-10-04", due_time: "11:59:00" }),
      "Asia/Riyadh",
      now,
    ),
  ).toBe("Overdue");
  expect(
    taskSection(
      task({ due_date: "2026-10-04", due_time: "12:00:00" }),
      "Asia/Riyadh",
      now,
    ),
  ).toBe("Today");
  expect(
    taskSection(
      task({ completed_at: now.toISO(), due_date: "2025-01-01" }),
      "Asia/Riyadh",
      now,
    ),
  ).toBe("Completed");
  expect(taskSection(task(), "Asia/Riyadh", now)).toBe("No due date");
});
it("validates optional fields and rejects time without date and malformed dates", () => {
  const fields = {
    title: "Read",
    description: "",
    course_id: "",
    due_date: "",
    due_time: "",
    priority: "low",
  };
  expect(taskFields.safeParse(fields).success).toBe(true);
  for (const update of [
    { due_time: "12:00" },
    { due_date: "2026-02-30" },
    { priority: "urgent" },
    { title: " " },
    { due_date: "2026-01-01", due_time: "24:00" },
  ])
    expect(taskFields.safeParse({ ...fields, ...update }).success).toBe(false);
});
it("sorts attention first then deadlines and priority, without mutating input", () => {
  const rows = [
    task({ id: "low", priority: "low" }),
    task({ id: "high", priority: "high" }),
    task({ id: "late", due_date: "2026-10-03" }),
  ];
  expect(sortTasks(rows, "Asia/Riyadh", now).map((t) => t.id)).toEqual([
    "late",
    "high",
    "low",
  ]);
  expect(rows[0].id).toBe("low");
});
it("calendar projection excludes undated tasks and distinguishes date-only from timed due dates", () => {
  expect(taskCalendarDate(task(), "Asia/Riyadh")).toBeNull();
  expect(
    taskCalendarDate(task({ due_date: "2026-10-04" }), "Asia/Riyadh"),
  ).toBe("2026-10-04");
  expect(
    Date.parse(
      taskCalendarDate(
        task({ due_date: "2026-10-04", due_time: "12:00:00" }),
        "Asia/Riyadh",
      )!,
    ),
  ).toBe(Date.parse("2026-10-04T09:00:00Z"));
});
it("uses earlier DST repeated time and handles an existing deadline after a timezone change", () => {
  expect(
    Date.parse(
      taskCalendarDate(
        task({ due_date: "2026-11-01", due_time: "01:30" }),
        "America/New_York",
      )!,
    ),
  ).toBe(Date.parse("2026-11-01T05:30:00Z"));
  expect(
    taskCalendarDate(
      task({ due_date: "2026-03-08", due_time: "02:30" }),
      "America/New_York",
    ),
  ).not.toBeNull();
});
