import { describe, it, expect } from "vitest";
import {
  wallTime,
  localInput,
  eventSchema,
} from "../../src/lib/domain/calendar";
describe("one-time calendar time rules", () => {
  it("uses profile timezone and roundtrips across midnight", () => {
    expect(wallTime("2026-10-04T00:30", "Asia/Riyadh")).toBe(
      "2026-10-03T21:30:00.000Z",
    );
    expect(localInput("2026-10-03T21:30:00Z", "Asia/Riyadh")).toBe(
      "2026-10-04T00:30",
    );
  });
  it("rejects nonexistent DST time, uses earlier repeated time", () => {
    expect(() => wallTime("2026-03-08T02:30", "America/New_York")).toThrow();
    expect(wallTime("2026-11-01T01:30", "America/New_York")).toBe(
      "2026-11-01T05:30:00.000Z",
    );
  });
  it("rejects inverted or zero intervals", () => {
    const v = {
      id: crypto.randomUUID(),
      semester_id: crypto.randomUUID(),
      revision: 0,
      title: "Review",
      course_id: "",
      color: "#a994e8",
      starts_at: "2026-10-03T12:00:00Z",
      ends_at: "2026-10-03T12:00:00Z",
    };
    expect(eventSchema.safeParse(v).success).toBe(false);
    expect(
      eventSchema.safeParse({ ...v, ends_at: "2026-10-04T01:00:00Z" }).success,
    ).toBe(true);
  });
});
