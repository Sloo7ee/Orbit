"use server";
import { requireUser } from "@/lib/data";
import { noteInput, type NoteInput, type NoteResult } from "@/lib/domain/notes";
export async function changeNote(input: NoteInput): Promise<NoteResult> {
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const { supabase } = await requireUser();
  try {
    const { data, error } = await supabase.rpc("change_note", {
      p_request: v.request_id,
      p_id: v.id,
      p_semester: v.semester_id,
      p_course: v.course_id,
      p_revision: v.revision,
      p_delete: v.deleted,
      p_title: v.title,
      p_content: v.content,
    });
    if (error)
      return {
        error: error.message.includes("changed")
          ? "This note changed in another session. Your draft is kept here. Reload the saved note to resolve the conflict."
          : error.message.includes("archived")
            ? "This semester is archived. Your draft is kept here. Restore the semester before saving."
            : "Could not save this note. Check the course and connection, then retry.",
      };
    return { revision: data, savedAt: new Date().toISOString() };
  } catch {
    return {
      error:
        "Connection interrupted. Your draft is kept here. Retry to confirm the save.",
    };
  }
}
