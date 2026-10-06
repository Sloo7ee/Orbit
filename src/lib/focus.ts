import "server-only";
import { cache } from "react";
import { loadWorkspace, requireUser } from "./data";
import type { FocusSnapshot } from "./domain/focus";
export async function focusSnapshot(
  semester: string | null,
): Promise<FocusSnapshot> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(
    "focus_snapshot",
    semester ? { p_semester: semester } : {},
  );
  if (error)
    throw new Error(
      "Could not load Focus. Check the Phase 7 migration and connection.",
    );
  return data as unknown as FocusSnapshot;
}
export const loadFocus = cache(async () => {
  const { selected } = await loadWorkspace();
  return focusSnapshot(selected?.id ?? null);
});
