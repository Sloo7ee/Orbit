import { it, expect } from "vitest";
import {
  summarizeGrades,
  assessmentResult,
  assessmentFields,
  assessmentCalendarDate,
} from "../../src/lib/domain/grades";
const item = (
  weight: number,
  score_earned: number | null,
  score_possible = 100,
) => ({ weight, score_earned, score_possible });
it("separates weighted grade, coverage and final course points", () => {
  expect(
    summarizeGrades([item(20, 18, 20), item(10, 8, 10), item(70, null)]),
  ).toMatchObject({
    current: "86.67",
    coverage: "30.00",
    earned: "26.00",
    configured: "100.00",
  });
  expect(summarizeGrades([]).current).toBeNull();
  expect(summarizeGrades([item(20, 0), item(80, null)])).toMatchObject({
    current: "0.00",
    coverage: "20.00",
    earned: "0.00",
  });
});
it("retains decimal precision until display", () => {
  expect(assessmentResult(item(25, 21.3, 25.25))).toEqual({
    percentage: "84.36",
    contribution: "21.09",
  });
  expect(
    summarizeGrades([
      item(33.3333, 1, 3),
      item(33.3333, 1, 3),
      item(33.3334, 1, 3),
    ]),
  ).toMatchObject({ current: "33.33", earned: "33.33", coverage: "100.00" });
  expect(assessmentResult(item(100, 1.005, 100)).percentage).toBe("1.01");
});
it("validates scores, weights and optional deadlines without rounding input", () => {
  const valid = {
    name: "Exam",
    weight: "20.5",
    score_earned: "",
    score_possible: "25.25",
    due_date: "",
    due_time: "",
    notes: "",
  };
  expect(assessmentFields.safeParse(valid).success).toBe(true);
  for (const invalid of [
    { weight: "0" },
    { weight: "100.1" },
    { weight: "1.00001" },
    { score_possible: "0" },
    { score_earned: "-1" },
    { score_earned: "26" },
    { due_time: "12:00" },
    { due_date: "2026-02-30" },
  ])
    expect(assessmentFields.safeParse({ ...valid, ...invalid }).success).toBe(
      false,
    );
});
it("preserves date-only deadlines and Riyadh wall time", () => {
  expect(
    assessmentCalendarDate(
      { due_date: "2026-10-04", due_time: null },
      "Asia/Riyadh",
    ),
  ).toBe("2026-10-04");
  expect(
    new Date(
      assessmentCalendarDate(
        { due_date: "2026-10-04", due_time: "12:30:00" },
        "Asia/Riyadh",
      )!,
    ).toISOString(),
  ).toBe("2026-10-04T09:30:00.000Z");
});
