import "server-only";
import { cache } from "react";
import { loadWorkspace, requireUser } from "./data";
export const loadTasks = cache(async () => {
  const workspace = await loadWorkspace();
  if (!workspace.selected) return [];
  const { supabase } = await requireUser();
  const { data, error, count } = await supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("semester_id", workspace.selected.id)
    .order("created_at")
    .limit(1000);
  if (error)
    throw new Error(
      "Could not load tasks. Check the Phase 5 migration and try again.",
    );
  if ((count ?? 0) > data.length)
    throw new Error(
      "This semester has more than 1,000 tasks. Task loading is limited to protect performance.",
    );
  return data;
});
