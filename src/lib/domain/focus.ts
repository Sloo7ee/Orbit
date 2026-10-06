import { z } from "zod";
import type { Database } from "../supabase/database.types";
export type FocusSession =
  Database["public"]["Tables"]["focus_sessions"]["Row"];
export type FocusSnapshot = {
  server_now: string;
  semester_id: string | null;
  active: FocusSession | null;
  recent: FocusSession[];
  today_ms: number;
  today_sessions: number;
};
export const focusCommand = z.object({
  id: z.uuid(),
  semester: z.uuid(),
  revision: z.number().int().nonnegative(),
  request: z.uuid(),
  operation: z.enum([
    "start",
    "pause",
    "resume",
    "next",
    "finish",
    "discard",
    "delete",
    "associate",
  ]),
  payload: z.object({
    mode: z.enum(["stopwatch", "pomodoro"]).optional(),
    focus_seconds: z.number().int().min(60).max(10800).optional(),
    break_seconds: z.number().int().min(60).max(3600).optional(),
    course_id: z.union([z.uuid(), z.literal("")]).optional(),
    task_id: z.union([z.uuid(), z.literal("")]).optional(),
    trim_ms: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
  }),
});
export type FocusCommand = z.infer<typeof focusCommand>;
// Project timestamp boundaries without writing every second or inventing later cycles.
export function focusClock(s: FocusSession, now: number) {
  let phase = s.phase,
    state = s.state,
    remaining = s.remaining_ms ?? 0,
    focused = s.focused_ms;
  const elapsed = s.segment_started_at
    ? Math.max(0, now - Date.parse(s.segment_started_at))
    : 0;
  if (state === "running") {
    if (s.mode === "stopwatch") focused += elapsed;
    else {
      if (phase === "focus") focused += Math.min(elapsed, remaining);
      remaining = Math.max(0, remaining - elapsed);
      if (remaining === 0 && phase === "focus") {
        phase = "break";
        remaining = Math.max(
          0,
          s.break_seconds * 1000 - Math.max(0, elapsed - (s.remaining_ms ?? 0)),
        );
      }
      if (remaining === 0 && phase === "break") {
        state = "ready";
        phase = "focus";
        remaining = s.focus_seconds * 1000;
      }
    }
  }
  return { phase, state, remaining, focused, elapsed };
}
export function timerLabel(ms: number, countdown = false) {
  const total = Math.max(
      0,
      countdown ? Math.ceil(ms / 1000) : Math.floor(ms / 1000),
    ),
    hours = Math.floor(total / 3600),
    minutes = Math.floor(total / 60) % 60,
    seconds = total % 60;
  return `${hours ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
export function durationLabel(ms: number) {
  const m = Math.floor(ms / 60000);
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60}m`
    : m
      ? `${m}m`
      : `${Math.floor(ms / 1000)}s`;
}
