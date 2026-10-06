import Link from "next/link";
import { redirect } from "next/navigation";
import { loadAcademic } from "@/lib/data";
import { loadAssessments } from "@/lib/grades";
import { GradeWorkspace } from "./grade-workspace";
export async function GradePage({ courseId }: { courseId?: string }) {
  const { selected, courses, profile } = await loadAcademic();
  const items = await loadAssessments();
  const course = courses.find((c) => c.id === courseId);
  if (courseId && !course) redirect("/grades");
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {course ? `${course.code} · GRADES` : "GRADES"}
          </p>
          <h1>{course?.name ?? "Grades"}</h1>
          <p className="page-subtitle">
            {selected?.name ?? "Select a semester to view grades."}
          </p>
        </div>
      </div>
      {selected ? (
        <GradeWorkspace
          key={`${selected.id}-${courseId ?? "overview"}`}
          course={course}
          courses={courses}
          items={items}
          semester={selected}
          zone={profile.timezone}
        />
      ) : (
        <Link href="/semesters">Manage semesters</Link>
      )}
    </div>
  );
}
