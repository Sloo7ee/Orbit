import { HomeOverview } from "@/components/home/home-overview";
import { WeeklyFocus } from "@/components/home/weekly-focus";
import { loadWeeklyFocus } from "@/lib/home";
import { loadAssessments } from "@/lib/grades";
import { loadTasks } from "@/lib/tasks";
import Link from "next/link";
import { loadAcademic } from "@/lib/data";
import { greeting, dateLabel } from "@/lib/domain/semester";
import { OrbitCalendar } from "@/components/calendar/orbit-calendar";
export async function HomePreview({
  calendarOnly = false,
}: {
  calendarOnly?: boolean;
}) {
  const { profile, selected, courses, upcoming } = await loadAcademic();
  const [tasks, assessments, week] = await Promise.all([
    loadTasks(),
    loadAssessments(),
    calendarOnly ? Promise.resolve(null) : loadWeeklyFocus(),
  ]);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{calendarOnly ? "CALENDAR" : "HOME"}</p>
          <h1>
            {calendarOnly
              ? "Calendar"
              : greeting(profile.display_name, profile.timezone)}
          </h1>
          {selected && (
            <p className="page-subtitle">
              {selected.name} · {dateLabel(selected.start_date)} –{" "}
              {dateLabel(selected.end_date)}
            </p>
          )}
        </div>
      </div>
      {!calendarOnly && selected && (
        <HomeOverview
          semester={selected}
          tasks={tasks}
          assessments={assessments}
          zone={profile.timezone}
        />
      )}
      {selected ? (
        <OrbitCalendar
          key={selected.id}
          semester={selected}
          courses={courses}
          zone={profile.timezone}
          upcoming={upcoming}
          tasks={tasks}
          assessments={assessments}
          home={!calendarOnly}
        />
      ) : (
        <div className="semester-prompt">
          <span>No semester selected.</span>
          <Link href="/semesters" className="button button--primary">
            Set up semester
          </Link>
        </div>
      )}
      {!calendarOnly && selected && week && (
        <WeeklyFocus days={week} tasks={tasks} zone={profile.timezone} />
      )}
    </div>
  );
}
