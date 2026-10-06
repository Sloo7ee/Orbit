"use server";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { focusSnapshot } from "@/lib/focus";
import { focusCommand, type FocusCommand } from "@/lib/domain/focus";
export async function readFocus(semester: string | null) {
  if (!z.uuid().nullable().safeParse(semester).success)
    return { error: "Invalid semester." };
  try {
    return { snapshot: await focusSnapshot(semester) };
  } catch {
    return {
      error: "Could not refresh Focus. Check your connection and retry.",
    };
  }
}
export async function changeFocus(input: FocusCommand) {
  const parsed = focusCommand.safeParse(input);
  if (!parsed.success)
    return { error: "Check the focus settings and try again." };
  const v = parsed.data;
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("change_focus", {
      p_request: v.request,
      p_id: v.id,
      p_semester: v.semester,
      p_revision: v.revision,
      p_operation: v.operation,
      p_payload: v.payload,
    });
    if (error) {
      const m = error.message;
      return {
        error: m.includes("changed")
          ? "This session changed in another tab or device. Refresh Focus before trying again."
          : m.includes("active focus")
            ? "You already have an active session. Refresh Focus to continue it."
            : m.includes("archived")
              ? "This semester is archived. Restore it before making changes."
              : m.includes("task course")
                ? "Use the course linked to this task."
                : m.includes("not running") ||
                    m.includes("not paused") ||
                    m.includes("already completed")
                  ? "The timer state changed. Refresh Focus before trying again."
                  : "Could not save Focus. Check the fields and connection, then retry.",
      };
    }
    // No route invalidation is needed: consumers receive the authoritative snapshot.
    return { snapshot: await focusSnapshot(v.semester) };
  } catch {
    return {
      error:
        "Connection interrupted. The change was not confirmed. Retry or refresh Focus to check its saved state.",
    };
  }
}
