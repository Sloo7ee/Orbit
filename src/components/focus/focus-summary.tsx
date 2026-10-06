"use client";
import Link from "next/link";
import { Timer } from "lucide-react";
import { useFocus } from "./focus-provider";
import { durationLabel, focusClock, timerLabel } from "@/lib/domain/focus";
export function FocusIndicator() {
  const { snapshot, now } = useFocus();
  const a = snapshot.active;
  if (!a) return null;
  const c = focusClock(a, now);
  return (
    <Link
      href="/focus"
      className="focus-indicator"
      aria-label="Open active focus session"
    >
      <Timer size={14} />
      <span>
        {c.state === "paused"
          ? "Paused"
          : c.state === "ready"
            ? "Ready"
            : c.phase === "break"
              ? "Break"
              : "Focus"}{" "}
        ·{" "}
        {timerLabel(
          a.mode === "stopwatch" ? c.focused : c.remaining,
          a.mode === "pomodoro",
        )}
      </span>
    </Link>
  );
}
export function FocusSummary() {
  const { snapshot, now } = useFocus();
  const a = snapshot.active,
    c = a ? focusClock(a, now) : null;
  return (
    <div className="focus-summary">
      <div>
        <span className="eyebrow">Focused today</span>
        <strong>{durationLabel(snapshot.today_ms)}</strong>
        {c && (
          <small>
            {a?.semester_id !== snapshot.semester_id
              ? "Session in another semester"
              : c.state === "paused"
                ? "Session paused"
                : c.state === "ready"
                  ? "Ready for focus"
                  : c.phase === "break"
                    ? "On a break"
                    : "Session running"}
          </small>
        )}
      </div>
      <Link href="/focus" className="button button--ghost">
        {a ? "Open Focus" : "Start focus"} <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}
