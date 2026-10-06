import { it, expect } from "vitest";
import { focusWeek, weeklyFocus, nextItems } from "../../src/lib/domain/home";
import { courseColor, coursePalette } from "../../src/lib/domain/course-colors";
import type { Task } from "../../src/lib/domain/tasks";
import type { Assessment } from "../../src/lib/domain/grades";
it("splits completed intervals over Riyadh days and clips at the current instant and week", () => {
  const now = new Date("2026-10-05T09:00:00Z");
  expect(focusWeek("Asia/Riyadh", now).start).toBe("2026-10-03T21:00:00.000Z");
  const days = weeklyFocus(
    [
      { started_at: "2026-10-03T20:00:00Z", ended_at: "2026-10-03T22:00:00Z" },
      { started_at: "2026-10-04T20:30:00Z", ended_at: "2026-10-04T21:30:00Z" },
      { started_at: "2026-10-05T08:30:00Z", ended_at: "2026-10-05T10:00:00Z" },
    ],
    "Asia/Riyadh",
    now,
  );
  expect(days.map((d) => d.milliseconds)).toEqual([
    5400000, 3600000, 0, 0, 0, 0, 0,
  ]);
  expect(
    weeklyFocus([], "Asia/Riyadh", now).every((d) => d.milliseconds === 0),
  ).toBe(true);
});
it("uses calendar boundaries through a 23-hour DST day", () => {
  const days = weeklyFocus(
    [{ started_at: "2026-03-08T05:00:00Z", ended_at: "2026-03-09T04:00:00Z" }],
    "America/New_York",
    new Date("2026-03-10T12:00:00Z"),
  );
  expect(days[0].milliseconds).toBe(23 * 3600000);
  expect(days.slice(1).every((d) => d.milliseconds === 0)).toBe(true);
});
it("orders deadlines in profile time, keeps date-only deadlines and excludes completed tasks", () => {
  const base = {
    id: "a",
    due_date: "2026-10-05",
    due_time: null,
    title: "Read",
    completed_at: null,
  } as Task;
  const assessment = {
    id: "c",
    due_date: "2026-10-05",
    due_time: "13:00:00",
    name: "Quiz",
    score_earned: 0,
  } as Assessment;
  const result = nextItems(
    [],
    [
      base,
      { ...base, id: "b", completed_at: "2026-10-05T00:00:00Z" },
      { ...base, id: "past", due_time: "11:00:00" },
    ],
    [assessment],
    "Asia/Riyadh",
    new Date("2026-10-05T09:00:00Z"),
  );
  expect(result.map((r) => r.id)).toEqual(["c", "a"]);
  expect(result[1].time).toBeNull();
  expect(result[0].kind).toBe("Assessment");
});
it("maps legacy colors without rewriting their values and guarantees readable event contrast", () => {
  expect(courseColor("#79C5AB").id).toBe("mint");
  expect(courseColor("#a994e8").id).toBe("lavender");
  expect(coursePalette).toContain(courseColor("#123456"));
  const lum = (h: string) =>
    [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: string, b: string) =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const c of coursePalette) {
    expect(courseColor(c.day).id).toBe(c.id);
    expect(courseColor(c.night).id).toBe(c.id);
    expect(contrast(c.day, "#24242d")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.night, "#f6f5fb")).toBeGreaterThanOrEqual(4.5);
  }
});
