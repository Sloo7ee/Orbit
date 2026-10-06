import Link from "next/link";
import { loadAcademic } from "@/lib/data";
import { loadTasks } from "@/lib/tasks";
import { TaskList } from "./task-list";
export async function TaskPage() {
  const { selected, courses, profile } = await loadAcademic();
  const tasks = await loadTasks();
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>To-do</h1>
          {selected && <p className="page-subtitle">{selected.name}</p>}
        </div>
      </div>
      {selected ? (
        <TaskList
          key={selected.id}
          tasks={tasks}
          courses={courses}
          semester={selected}
          zone={profile.timezone}
        />
      ) : (
        <div className="semester-prompt">
          No semester selected. <Link href="/semesters">Set up semester</Link>
        </div>
      )}
    </div>
  );
}
