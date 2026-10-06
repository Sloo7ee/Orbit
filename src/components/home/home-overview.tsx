"use client";
import Link from "next/link";
import { DateTime } from "luxon";
import { nextItems } from "@/lib/domain/home";
import { semesterProgress } from "@/lib/domain/semester";
import type { Semester } from "@/lib/supabase/database.types";
import type { Task } from "@/lib/domain/tasks";
import type { Assessment } from "@/lib/domain/grades";
import { durationLabel } from "@/lib/domain/focus";
import { useFocus } from "@/components/focus/focus-provider";
import { FocusSummary } from "@/components/focus/focus-summary";
export function HomeOverview({
  semester,
  tasks,
  assessments,
  zone,
}: {
  semester: Semester;
  tasks: Task[];
  assessments: Assessment[];
  zone: string;
}) {
  const { snapshot, now } = useFocus();
  const progress = semesterProgress(
    semester.start_date,
    semester.end_date,
    zone,
    new Date(now),
  );
  const remaining = tasks.filter((t) => !t.completed_at).length;
  const next = nextItems([], [], assessments, zone, new Date(now))[0];
  return (
    <section className="home-summaries" aria-label="Semester overview">
      <div className="summary-tile">
        <span>Semester progress</span>
        <strong>
          {progress.percent}
          <small>%</small>
        </strong>
        <p>{progress.daysRemaining} days remaining</p>
        <progress
          aria-label="Semester progress"
          value={progress.percent}
          max={100}
        />
      </div>
      <div className="summary-tile">
        <span>Tasks remaining</span>
        <strong>{remaining}</strong>
        <p>
          {tasks.filter((t) => !!t.completed_at).length} completed ·{" "}
          <Link href="/todo">View tasks</Link>
        </p>
      </div>
      <div className="summary-tile academic-summary">
        <span>Next assessment</span>
        <strong>
          {next ? DateTime.fromISO(next.date).toFormat("MMM d") : "—"}
        </strong>
        <p>{next?.title ?? "No upcoming assessments"}</p>
      </div>
      <div className="summary-tile">
        <span>Focused today</span>
        <strong>{durationLabel(snapshot.today_ms)}</strong>
        <p>
          {snapshot.today_sessions} completed{" "}
          {snapshot.today_sessions === 1 ? "session" : "sessions"}
        </p>
        <div className="summary-focus-control">
          <FocusSummary />
        </div>
      </div>
    </section>
  );
}
