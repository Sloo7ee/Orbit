"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, loadWorkspace } from "@/lib/data";
import { taskFields } from "@/lib/domain/tasks";
import { wallTime } from "@/lib/domain/calendar";
import type { ActionResult } from "@/lib/domain/validation";
export async function changeTask(form: FormData): Promise<ActionResult> {
  const base = z
    .object({
      id: z.uuid(),
      semester_id: z.uuid(),
      request_id: z.uuid(),
      revision: z.coerce.number().int().nonnegative(),
      operation: z.enum(["save", "complete", "delete"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!base.success) return { error: "Reload and try again." };
  const v = base.data;
  let payload: Record<string, string | boolean> = {};
  if (v.operation === "save") {
    const fields = taskFields.safeParse(Object.fromEntries(form));
    if (!fields.success)
      return { error: "Check the task fields. A due time needs a due date." };
    payload = fields.data;
    if (fields.data.due_time) {
      const { profile } = await loadWorkspace();
      try {
        wallTime(
          `${fields.data.due_date}T${fields.data.due_time}`,
          profile.timezone,
        );
      } catch {
        return {
          error: "This local due time does not exist. Choose another time.",
        };
      }
    }
  } else if (v.operation === "complete") {
    if (!["true", "false"].includes(String(form.get("completed"))))
      return { error: "Invalid completion status." };
    payload = { completed: form.get("completed") === "true" };
  }
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("change_task", {
      p_request: v.request_id,
      p_id: v.id,
      p_semester: v.semester_id,
      p_revision: v.revision,
      p_operation: v.operation,
      p_payload: payload,
    });
    if (error)
      return {
        error: error.message.includes("changed")
          ? "This task changed in another session. Reload before saving again."
          : error.message.includes("archived")
            ? "This semester is archived. Restore it before making changes."
            : "Could not save task. Check the fields and connection, then try again.",
      };
    revalidatePath("/", "layout");
    return {
      success: v.operation === "delete" ? "Task deleted." : "Task saved.",
      revision: data,
    };
  } catch {
    return {
      error:
        "Connection interrupted. Your changes were not confirmed. Try again.",
    };
  }
}
