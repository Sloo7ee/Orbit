"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { scheduleFields } from "@/lib/domain/recurrence";
import type { ActionResult } from "@/lib/domain/validation";
export async function changeSchedule(form: FormData): Promise<ActionResult> {
  const base = z
    .object({
      request_id: z.uuid(),
      id: z.uuid(),
      revision: z.coerce.number().int().min(0),
      scope: z.enum(["create", "one", "future", "all"]),
      original: z.union([z.iso.date(), z.literal("")]),
      delete: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!base.success) return { error: "Check the schedule and try again." };
  const v = base.data;
  let payload: Record<string, string | number[] | boolean> = {
    confirm_reset: form.get("confirm_reset") === "on",
  };
  if (v.delete === "false") {
    if (v.scope === "one") {
      const parsed = z
        .object({
          starts_at: z.iso.datetime({ offset: true }),
          ends_at: z.iso.datetime({ offset: true }),
          location: z.string().trim().max(200),
        })
        .refine((a) => Date.parse(a.ends_at) > Date.parse(a.starts_at))
        .safeParse(Object.fromEntries(form));
      if (!parsed.success)
        return { error: "End must be after start. Check the meeting times." };
      payload = { ...payload, ...parsed.data };
    } else {
      const parsed = scheduleFields.safeParse({
        ...Object.fromEntries(form),
        weekdays: form.getAll("weekday").map(Number),
      });
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      payload = { ...payload, ...parsed.data };
      if (v.scope === "create") {
        const course = z.uuid().safeParse(form.get("course_id"));
        if (!course.success) return { error: "Choose a course." };
        payload.course_id = course.data;
      }
    }
  }
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("change_schedule", {
      p_request: v.request_id,
      p_id: v.id,
      p_revision: v.revision,
      p_scope: v.scope,
      p_original: v.original || null,
      p_delete: v.delete === "true",
      p_payload: payload,
    });
    if (error) {
      const message = error.message;
      return {
        error: message.includes("changed")
          ? "This schedule changed in another session. Reload before saving again."
          : message.includes("archived")
            ? "This semester is archived. Restore it before making changes."
            : message.includes("semester")
              ? "Keep the schedule dates and meeting within this semester."
              : message.includes("Future schedule")
                ? "Future meetings must begin on or after the original selected meeting date."
                : "Could not save the schedule. Check the fields and try again.",
      };
    }
    revalidatePath("/", "layout");
    return {
      success: v.delete === "true" ? "Meetings deleted." : "Schedule saved.",
    };
  } catch {
    return {
      error:
        "Connection interrupted. Your changes have not been confirmed. Try again.",
    };
  }
}
