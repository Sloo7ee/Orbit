import { it, expect } from "vitest";
import {
  focusClock,
  timerLabel,
  focusCommand,
  type FocusSession,
} from "../../src/lib/domain/focus";
const start = Date.parse("2026-10-04T12:00:00Z");
const base = {
  mode: "pomodoro",
  state: "running",
  phase: "focus",
  focused_ms: 0,
  focus_seconds: 1500,
  break_seconds: 300,
  remaining_ms: 1500000,
  segment_started_at: new Date(start).toISOString(),
} as FocusSession;
it("projects focus, break and ready boundaries without adding unattended cycles", () => {
  expect(focusClock(base, start + 60000)).toMatchObject({
    focused: 60000,
    remaining: 1440000,
    phase: "focus",
  });
  expect(focusClock(base, start + 1500000)).toMatchObject({
    focused: 1500000,
    remaining: 300000,
    phase: "break",
    state: "running",
  });
  expect(focusClock(base, start + 1560000)).toMatchObject({
    focused: 1500000,
    remaining: 240000,
    phase: "break",
  });
  expect(focusClock(base, start + 86400000)).toMatchObject({
    focused: 1500000,
    remaining: 1500000,
    state: "ready",
  });
});
it("stopwatch and pauses use timestamps rather than tick counts", () => {
  expect(
    focusClock(
      { ...base, mode: "stopwatch", remaining_ms: null, focused_ms: 10000 },
      start + 123456,
    ).focused,
  ).toBe(133456);
  expect(
    focusClock(
      {
        ...base,
        state: "paused",
        segment_started_at: null,
        focused_ms: 12345,
        remaining_ms: 1490000,
      },
      start + 86400000,
    ),
  ).toMatchObject({ focused: 12345, remaining: 1490000, state: "paused" });
  expect(
    focusClock(
      { ...base, phase: "break", focused_ms: 1500000, remaining_ms: 300000 },
      start + 100000,
    ),
  ).toMatchObject({ focused: 1500000, remaining: 200000 });
  expect(focusClock({ ...base, mode: "stopwatch" }, start - 1000).focused).toBe(
    0,
  );
});
it("formats elapsed and remaining values and validates simple configuration", () => {
  expect(timerLabel(999)).toBe("00:00");
  expect(timerLabel(999, true)).toBe("00:01");
  expect(timerLabel(3601000)).toBe("1:00:01");
  const v = {
    id: crypto.randomUUID(),
    request: crypto.randomUUID(),
    semester: crypto.randomUUID(),
    revision: 0,
    operation: "start",
    payload: { mode: "pomodoro", focus_seconds: 1200, break_seconds: 180 },
  };
  expect(focusCommand.safeParse(v).success).toBe(true);
  for (const payload of [
    { focus_seconds: 0 },
    { break_seconds: 3601 },
    { trim_ms: -1 },
    { mode: "ai" },
  ])
    expect(focusCommand.safeParse({ ...v, payload }).success).toBe(false);
});
