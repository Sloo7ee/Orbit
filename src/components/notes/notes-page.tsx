import Link from "next/link";
import { loadAcademic, requireUser } from "@/lib/data";
import { NotesWorkspace } from "./notes-workspace";
export async function NotesPage() {
  const { selected, courses, profile } = await loadAcademic();
  if (!selected)
    return (
      <div className="page-enter">
        <div className="page-heading">
          <h1>Notes</h1>
        </div>
        <div className="semester-prompt">
          No semester selected. <Link href="/semesters">Set up semester</Link>
        </div>
      </div>
    );
  const { supabase } = await requireUser();
  const loadedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("semester_id", selected.id)
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(1000);
  if (error)
    throw new Error(
      "Could not load notes. Check the Notes migration and connection, then retry.",
    );
  return (
    <NotesWorkspace
      key={selected.id}
      notes={data}
      loadedAt={loadedAt}
      courses={courses}
      semester={selected}
      zone={profile.timezone}
    />
  );
}
