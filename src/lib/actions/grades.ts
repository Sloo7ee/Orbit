"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, loadWorkspace } from "@/lib/data";
import { assessmentFields } from "@/lib/domain/grades";
import { wallTime } from "@/lib/domain/calendar";
import type { ActionResult } from "@/lib/domain/validation";
export async function changeAssessment(form: FormData): Promise<ActionResult> {
  const base = z
    .object({
      id: z.uuid(),
      course_id: z.uuid(),
      semester_id: z.uuid(),
      request_id: z.uuid(),
      revision: z.coerce.number().int().nonnegative(),
      delete: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!base.success) return { error: "Reload and try again." };
  const v = base.data;
  let payload: Record<string, string> = {};
  if (v.delete === "false") {
    const parsed = assessmentFields.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    payload = parsed.data;
    if (payload.due_time) {
      const { profile } = await loadWorkspace();
      try {
        wallTime(`${payload.due_date}T${payload.due_time}`, profile.timezone);
      } catch {
        return {
          error: "This local due time does not exist. Choose another time.",
        };
      }
    }
  }
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("change_assessment", {
      p_request: v.request_id,
      p_id: v.id,
      p_course: v.course_id,
      p_semester: v.semester_id,
      p_revision: v.revision,
      p_delete: v.delete === "true",
      p_payload: payload,
    });
    if (error)
      return {
        error: error.message.includes("100 percent")
          ? "Total assessment weight cannot exceed 100%. Reduce a weight and try again."
          : error.message.includes("changed")
            ? "This assessment changed in another session. Reload before saving again."
            : error.message.includes("archived")
              ? "This semester is archived. Restore it before making changes."
              : "Could not save assessment. Check the fields and connection, then try again.",
      };
    revalidatePath("/", "layout");
    return {
      success:
        v.delete === "true" ? "Assessment deleted." : "Assessment saved.",
      revision: data,
    };
  } catch {
    return {
      error: "Connection interrupted. Your entries are still here. Try again.",
    };
  }
}
