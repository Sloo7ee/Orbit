"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recurringRange } from "@/lib/schedules";
import { requireUser } from "@/lib/data";
import { courseSchema, eventSchema } from "@/lib/domain/calendar";
import type { ActionResult } from "@/lib/domain/validation";
const failure = (message: string): ActionResult => ({
  error: message.includes("assessments_course_history")
    ? "This course has assessments and cannot be deleted. Archive the semester to preserve grade history."
    : message.includes("changed")
      ? "This record changed in another session. Reload before saving again."
      : message.includes("archived")
        ? "This semester is archived. Restore it before making changes."
        : "Could not save. Check your connection and try again.",
});
export async function saveCourse(form: FormData): Promise<ActionResult> {
  const parsed = courseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Check the course fields and try again." };
  try {
    const { supabase } = await requireUser();
    const v = parsed.data;
    const { data, error } = await supabase.rpc("save_course", {
      p_id: v.id,
      p_semester: v.semester_id,
      p_revision: v.revision,
      p_code: v.code,
      p_name: v.name,
      p_instructor: v.instructor,
      p_color: v.color,
    });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return { success: "Course saved.", revision: data.revision };
  } catch {
    return failure("");
  }
}
export async function saveEvent(form: FormData): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Check the title and times. End must be after start." };
  try {
    const { supabase } = await requireUser();
    const v = parsed.data;
    const { data, error } = await supabase.rpc("save_event", {
      p_id: v.id,
      p_semester: v.semester_id,
      p_revision: v.revision,
      p_title: v.title,
      p_start: v.starts_at,
      p_end: v.ends_at,
      p_course: v.course_id || null,
      p_color: v.color,
    });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return { success: "Event saved.", revision: data.revision };
  } catch {
    return failure("");
  }
}
export async function deleteAcademic(form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      semester_id: z.uuid(),
      revision: z.coerce.number().int().positive(),
      kind: z.enum(["course", "event"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Reload and try again." };
  try {
    const { supabase } = await requireUser();
    const v = parsed.data;
    const { error } = await supabase.rpc("delete_academic", {
      p_id: v.id,
      p_semester: v.semester_id,
      p_revision: v.revision,
      p_kind: v.kind,
    });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return { success: "Deleted." };
  } catch {
    return failure("");
  }
}
export async function calendarRange(
  semester: string,
  start: string,
  end: string,
) {
  if (
    !z.uuid().safeParse(semester).success ||
    !z.iso.datetime({ offset: true }).safeParse(start).success ||
    !z.iso.datetime({ offset: true }).safeParse(end).success ||
    Date.parse(end) <= Date.parse(start) ||
    Date.parse(end) - Date.parse(start) > 62 * 86400000
  )
    return { error: "Invalid calendar range." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("semester_id", semester)
    .lt("starts_at", end)
    .gt("ends_at", start)
    .order("starts_at")
    .limit(1000);
  if (error) return { error: "Could not load events. Try again." };
  if (data.length >= 1000)
    return { error: "Too many events. Switch to a smaller view." };
  try {
    const courses = await supabase
      .from("courses")
      .select("*")
      .eq("semester_id", semester);
    if (courses.error) throw courses.error;
    const tasks = await supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("semester_id", semester)
      .gte("due_date", start.slice(0, 10))
      .lte("due_date", end.slice(0, 10))
      .limit(1000);
    if (tasks.error)
      throw new Error(
        "Could not load tasks. Check the Phase 5 migration and try again.",
      );
    if ((tasks.count ?? 0) > tasks.data.length)
      throw new Error("Too many tasks in this calendar range.");
    const assessments = await supabase
      .from("assessments")
      .select("*", { count: "exact" })
      .eq("semester_id", semester)
      .gte("due_date", start.slice(0, 10))
      .lte("due_date", end.slice(0, 10))
      .limit(1000);
    if (assessments.error)
      throw new Error(
        "Could not load assessments. Check the Phase 6 migration and try again.",
      );
    if ((assessments.count ?? 0) > assessments.data.length)
      throw new Error("Too many assessments in this range.");
    const recurring = await recurringRange(
      supabase,
      semester,
      start,
      end,
      courses.data,
    );
    return {
      data: [...data, ...recurring.events],
      tasks: tasks.data,
      assessments: assessments.data,
      skipped: recurring.skipped,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not load class meetings.",
    };
  }
}
