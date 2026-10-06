import { describe, it, expect } from "vitest";
import {
  semesterProgress,
  localDate,
  greeting,
  isDate,
} from "../../src/lib/domain/semester";
import { profileSchema, semesterSchema } from "../../src/lib/domain/validation";
describe("semester calendar-day progress", () => {
  it("clamps before/after and includes the final day", () => {
    const progress = (at: string) =>
      semesterProgress("2026-10-01", "2026-10-10", "Asia/Riyadh", new Date(at));
    expect(progress("2026-09-30T12:00:00Z")).toEqual({
      percent: 0,
      daysRemaining: 10,
      status: "upcoming",
    });
    expect(progress("2026-10-05T12:00:00Z")).toEqual({
      percent: 40,
      daysRemaining: 6,
      status: "active",
    });
    expect(progress("2026-10-10T12:00:00Z")).toEqual({
      percent: 90,
      daysRemaining: 1,
      status: "active",
    });
    expect(progress("2026-10-10T21:00:00Z")).toEqual({
      percent: 100,
      daysRemaining: 0,
      status: "ended",
    });
  });
  it("supports one-day semesters and leap years", () => {
    expect(
      semesterProgress(
        "2028-02-29",
        "2028-02-29",
        "UTC",
        new Date("2028-02-29T20:00Z"),
      ),
    ).toEqual({ percent: 0, daysRemaining: 1, status: "active" });
    expect(isDate("2027-02-29")).toBe(false);
    expect(isDate("2028-02-29")).toBe(true);
  });
  it("uses local days through DST and midnight", () => {
    expect(localDate(new Date("2026-10-03T21:00Z"), "Asia/Riyadh")).toBe(
      "2026-10-04",
    );
    expect(
      semesterProgress(
        "2026-03-07",
        "2026-03-10",
        "America/New_York",
        new Date("2026-03-09T04:30Z"),
      ),
    ).toEqual({ percent: 50, daysRemaining: 2, status: "active" });
  });
  it("uses the first name and profile timezone", () => {
    expect(
      greeting(" Saleh Ibrahim ", "Asia/Riyadh", new Date("2026-10-03T04:00Z")),
    ).toBe("Good morning, Saleh.");
  });
  it("rejects invalid dates, timezone, whitespace names, and reversed ranges", () => {
    expect(
      profileSchema.safeParse({ display_name: " ", timezone: "UTC" }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({
        display_name: "Saleh",
        timezone: "Mars/Olympus",
      }).success,
    ).toBe(false);
    expect(
      semesterSchema.safeParse({
        id: "1a532d03-d6db-4f8b-ab61-1d4b79550791",
        name: "Fall",
        start_date: "2026-10-10",
        end_date: "2026-10-01",
      }).success,
    ).toBe(false);
    expect(isDate("2026-04-31")).toBe(false);
  });
});
