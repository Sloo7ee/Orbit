"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  profileSchema,
  semesterSchema,
  type ActionResult,
} from "@/lib/domain/validation";
async function authenticated() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase;
}
function failure(message: string): ActionResult {
  if (message.includes("active focus"))
    return {
      error:
        "Finish or discard the active focus session before archiving this semester.",
    };
  if (message.includes("changed") || message.includes("duplicate key"))
    return {
      error:
        "This record changed in another session. Reload the page and try again. Your current entries have not been saved.",
    };
  return {
    error: "Could not save this change. Check your connection and try again.",
  };
}
export async function saveProfile(form: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  const revision = z.coerce
    .number()
    .int()
    .min(0)
    .safeParse(form.get("revision"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!revision.success) return { error: "Reload the page and try again." };
  try {
    const client = await authenticated();
    if (!client) return { error: "Your session expired. Sign in again." };
    const { data, error } = await client.rpc("save_profile", {
      p_name: parsed.data.display_name,
      p_timezone: parsed.data.timezone,
      p_revision: revision.data,
    });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return revision.data === 0
      ? { redirectTo: "/semesters" }
      : { success: "Profile saved.", revision: data.revision };
  } catch {
    return failure("");
  }
}
export async function createSemester(form: FormData): Promise<ActionResult> {
  const parsed = semesterSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const client = await authenticated();
    if (!client) return { error: "Your session expired. Sign in again." };
    const { error } = await client.rpc("create_semester", {
      p_id: parsed.data.id,
      p_name: parsed.data.name,
      p_start: parsed.data.start_date,
      p_end: parsed.data.end_date,
    });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return {
      success: "Semester created and selected.",
      redirectTo: "/semesters?created=1",
    };
  } catch {
    return failure("");
  }
}
export async function selectSemester(form: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Choose a semester." };
  try {
    const client = await authenticated();
    if (!client) return { error: "Your session expired. Sign in again." };
    const { error } = await client.rpc("select_semester", { p_id: id.data });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return { success: "Semester selected." };
  } catch {
    return failure("");
  }
}
export async function archiveSemester(form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      revision: z.coerce.number().int().positive(),
      archive: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Reload the page and try again." };
  try {
    const client = await authenticated();
    if (!client) return { error: "Your session expired. Sign in again." };
    const { error } = await client.rpc("archive_semester", {
      p_id: parsed.data.id,
      p_revision: parsed.data.revision,
      p_archive: parsed.data.archive === "true",
    });
    if (error) return failure(error.message);
    revalidatePath("/", "layout");
    return {
      success:
        parsed.data.archive === "true"
          ? "Semester archived. Its history is preserved."
          : "Semester restored.",
    };
  } catch {
    return failure("");
  }
}
