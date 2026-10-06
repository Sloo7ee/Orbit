import { describe, it, expect } from "vitest";
import {
  expandSchedules,
  meetingOn,
  upcomingMeetings,
} from "../../src/lib/domain/recurrence";
import type {
  CourseSchedule,
  ScheduleException,
} from "../../src/lib/supabase/database.types";
const s: CourseSchedule = {
  id: crypto.randomUUID(),
  owner_id: crypto.randomUUID(),
  semester_id: crypto.randomUUID(),
  course_id: null,
  title: "Lecture",
  color: "#a994e8",
  weekdays: [0, 2, 4],
  start_time: "09:00:00",
  end_time: "10:00:00",
  location: "Room 5",
  timezone: "Asia/Riyadh",
  effective_start: "2026-09-01",
  effective_end: "2026-12-31",
  deleted: false,
  revision: 1,
  created_at: "2026-01-01T00:00:00Z",
};
function exception(
  date: string,
  values: Partial<ScheduleException> = {},
): ScheduleException {
  return {
    id: crypto.randomUUID(),
    owner_id: s.owner_id,
    semester_id: s.semester_id,
    schedule_id: s.id,
    original_date: date,
    cancelled: false,
    starts_at: "2026-10-14T08:00:00Z",
    ends_at: "2026-10-14T09:00:00Z",
    location: "Lab",
    revision: 1,
    ...values,
  };
}
describe("bounded weekly recurrence", () => {
  it("expands matching weekdays with Riyadh instants and inclusive semester dates", () => {
    const result = expandSchedules(
      [s],
      [],
      [],
      "2026-09-01T00:00:00Z",
      "2026-10-01T00:00:00Z",
    );
    expect(result.events).toHaveLength(13);
    expect(result.events[0].starts_at).toBe("2026-09-01T06:00:00.000Z");
    expect(meetingOn(s, "2026-12-31")).not.toBeNull();
    expect(meetingOn(s, "2027-01-03")).toBeNull();
  });
  it("supports multiple independent blocks without collapsing their identities", () => {
    const result = expandSchedules(
      [
        s,
        {
          ...s,
          id: crypto.randomUUID(),
          start_time: "13:00:00",
          end_time: "14:00:00",
        },
      ],
      [],
      [],
      "2026-09-01T00:00:00Z",
      "2026-09-02T00:00:00Z",
    );
    expect(result.events).toHaveLength(2);
    expect(new Set(result.events.map((e) => e.id)).size).toBe(2);
  });
  it("removes originals and includes moved-in exceptions exactly once", () => {
    const ex = exception("2026-09-01");
    expect(
      expandSchedules(
        [s],
        [ex],
        [],
        "2026-09-01T00:00:00Z",
        "2026-09-02T00:00:00Z",
      ).events,
    ).toHaveLength(0);
    const oct = expandSchedules(
      [s],
      [ex],
      [],
      "2026-10-14T00:00:00Z",
      "2026-10-15T00:00:00Z",
    ).events;
    expect(oct).toHaveLength(1);
    expect(oct[0].id).toBe(`${s.id}:2026-09-01`);
    expect(oct[0].location).toBe("Lab");
  });
  it("cancellation hides only one occurrence", () => {
    const ex = exception("2026-09-01", {
      cancelled: true,
      starts_at: null,
      ends_at: null,
    });
    expect(
      expandSchedules(
        [s],
        [ex],
        [],
        "2026-09-01T00:00:00Z",
        "2026-09-08T00:00:00Z",
      ).events,
    ).toHaveLength(2);
  });
  it("keeps wall time across DST and reports skipped gaps", () => {
    const us = {
      ...s,
      timezone: "America/New_York",
      weekdays: [0],
      effective_start: "2026-03-01",
      effective_end: "2026-03-31",
    };
    expect(meetingOn(us, "2026-03-01")?.starts_at).toBe(
      "2026-03-01T14:00:00.000Z",
    );
    expect(meetingOn(us, "2026-03-08")?.starts_at).toBe(
      "2026-03-08T13:00:00.000Z",
    );
    const gap = expandSchedules(
      [{ ...us, start_time: "02:30:00", end_time: "03:30:00" }],
      [],
      [],
      "2026-03-08T00:00:00Z",
      "2026-03-09T00:00:00Z",
    );
    expect(gap.events).toHaveLength(0);
    expect(gap.skipped).toBe(1);
  });
  it("uses earlier repeated offset and handles overnight overlap/exclusive ends", () => {
    const us = {
      ...s,
      timezone: "America/New_York",
      weekdays: [0],
      effective_start: "2026-11-01",
      effective_end: "2026-11-01",
      start_time: "01:30:00",
      end_time: "02:30:00",
    };
    expect(meetingOn(us, "2026-11-01")?.starts_at).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    const overnight = { ...s, start_time: "23:30:00", end_time: "01:00:00" };
    expect(
      expandSchedules(
        [overnight],
        [],
        [],
        "2026-09-01T21:00:00Z",
        "2026-09-01T22:00:00Z",
      ).events,
    ).toHaveLength(1);
    expect(
      expandSchedules(
        [overnight],
        [],
        [],
        "2026-09-01T22:00:00Z",
        "2026-09-01T23:00:00Z",
      ).events,
    ).toHaveLength(0);
  });
  it("bounds work independently of long semester length", () => {
    expect(() =>
      expandSchedules(
        [s],
        [],
        [],
        "2026-01-01T00:00:00Z",
        "2027-01-01T00:00:00Z",
      ),
    ).toThrow("Invalid calendar range");
  });
});

it("finds upcoming meetings in distant terms without expanding intervening months", () => {
  const future = {
    ...s,
    effective_start: "2027-09-01",
    effective_end: "2027-12-31",
  };
  const next = upcomingMeetings([future], [], [], "2026-01-01T00:00:00Z");
  expect(next).toHaveLength(3);
  expect(next[0].recurring!.original_date).toBe("2027-09-02");
});
it("Next Up skips cancellations and includes a moved past original", () => {
  const cancelled = exception("2026-09-01", {
    cancelled: true,
    starts_at: null,
    ends_at: null,
  });
  const moved = exception("2026-09-03", {
    starts_at: "2026-10-14T08:00:00Z",
    ends_at: "2026-10-14T09:00:00Z",
  });
  const next = upcomingMeetings(
    [s],
    [cancelled, moved],
    [],
    "2026-10-14T07:00:00Z",
  );
  expect(next[0].id).toBe(s.id + ":2026-09-03");
  expect(next).toHaveLength(3);
});
