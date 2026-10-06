import "server-only";
import { loadWorkspace, requireUser } from "./data";
import { weeklyFocus } from "./domain/home";
import { readWeeklyFocus } from "./focus-report";
export async function loadWeeklyFocus() {
  const { selected, profile } = await loadWorkspace();
  if (!selected) return weeklyFocus([], profile.timezone);
  const { supabase } = await requireUser();
  return readWeeklyFocus(supabase, selected.id, profile.timezone);
}
