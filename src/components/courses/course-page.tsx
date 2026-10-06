import Link from "next/link";
import { requireUser } from "@/lib/data";
import { loadAcademic } from "@/lib/data";
import { CourseManager } from "./course-manager";
export async function CoursePage() {
  const { selected, courses, profile } = await loadAcademic();
  const { supabase } = await requireUser();
  const schedules = selected
    ? await supabase
        .from("course_schedules")
        .select("*")
        .eq("semester_id", selected.id)
        .eq("deleted", false)
        .order("effective_start")
    : { data: [], error: null };
  if (schedules.error) throw new Error("Could not load course schedules.");
  return (
    <div className="page-enter">
      {selected ? (
        <CourseManager
          key={selected.id}
          semester={selected}
          courses={courses}
          schedules={schedules.data ?? []}
          zone={profile.timezone}
        />
      ) : (
        <>
          <h1>Courses</h1>
          <p>Select a semester to manage courses.</p>
          <Link href="/semesters" className="button">
            Manage semesters
          </Link>
        </>
      )}
    </div>
  );
}
