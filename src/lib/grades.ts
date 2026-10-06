import "server-only";
import { cache } from "react";
import { loadWorkspace, requireUser } from "./data";
export const loadAssessments = cache(async () => {
  const { selected } = await loadWorkspace();
  if (!selected) return [];
  const { supabase } = await requireUser();
  const { data, error, count } = await supabase
    .from("assessments")
    .select("*", { count: "exact" })
    .eq("semester_id", selected.id)
    .order("created_at")
    .limit(1000);
  if (error)
    throw new Error(
      "Could not load assessments. Check the Phase 6 migration and try again.",
    );
  if ((count ?? 0) > data.length)
    throw new Error(
      "This semester has more than 1,000 assessments. Loading is limited to protect performance.",
    );
  return data;
});
