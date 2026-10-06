import { semesterProgress, dateLabel } from "@/lib/domain/semester";
import type { Semester } from "@/lib/supabase/database.types";
export function SemesterProgress({
  semester,
  timezone,
}: {
  semester: Semester;
  timezone: string;
}) {
  const progress = semesterProgress(
    semester.start_date,
    semester.end_date,
    timezone,
  );
  return (
    <div className="semester-progress">
      <div className="progress-label">
        <span>
          {progress.status === "upcoming"
            ? `Starts ${dateLabel(semester.start_date)}`
            : progress.status === "ended"
              ? "Semester ended"
              : `${progress.daysRemaining} ${progress.daysRemaining === 1 ? "day" : "days"} remaining`}
        </span>
        <strong>{progress.percent}%</strong>
      </div>
      <progress
        value={progress.percent}
        max={100}
        aria-label={`${semester.name} elapsed`}
      />
    </div>
  );
}
