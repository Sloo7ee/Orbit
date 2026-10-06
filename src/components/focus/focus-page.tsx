import Link from "next/link";
import { loadAcademic } from "@/lib/data";
import { loadTasks } from "@/lib/tasks";
import { FocusWorkspace } from "./focus-workspace";
export async function FocusPage() {
  const { selected, courses, profile, semesters } = await loadAcademic();
  const tasks = await loadTasks();
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STUDY</p>
          <h1>Focus</h1>
          <p className="page-subtitle">
            {selected?.name ?? "Select a semester to begin."}
          </p>
        </div>
      </div>
      {selected ? (
        <FocusWorkspace
          key={selected.id}
          semester={selected}
          semesters={semesters}
          courses={courses}
          tasks={tasks}
          zone={profile.timezone}
        />
      ) : (
        <Link href="/semesters">Set up semester</Link>
      )}
    </div>
  );
}
