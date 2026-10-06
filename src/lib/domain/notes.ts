import { z } from "zod";
import type { Database, Json } from "@/lib/supabase/database.types";
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export const emptyNote = { type: "doc", content: [{ type: "paragraph" }] };
export function safeNoteLink(value: string) {
  return (
    value.length <= 2048 && /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/.test(value)
  );
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validNoteContent(value: unknown): boolean {
  if (new TextEncoder().encode(JSON.stringify(value) ?? "").length > 190000)
    return false;
  function node(n: unknown, parent = "", depth = 0): boolean {
    if (!object(n) || depth > 24 || typeof n.type !== "string") return false;
    const t = n.type;
    if (
      ![
        "doc",
        "paragraph",
        "heading",
        "text",
        "bulletList",
        "orderedList",
        "listItem",
        "blockquote",
      ].includes(t)
    )
      return false;
    if ((!parent && t !== "doc") || (parent && t === "doc")) return false;
    if (["paragraph", "heading"].includes(parent) && t !== "text") return false;
    if (["bulletList", "orderedList"].includes(parent) && t !== "listItem")
      return false;
    if (
      ["doc", "blockquote", "listItem"].includes(parent) &&
      ![
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
      ].includes(t)
    )
      return false;
    if (
      Object.keys(n).some(
        (k) => !["type", "content", "text", "marks", "attrs"].includes(k),
      )
    )
      return false;
    if (t === "text") {
      if (
        typeof n.text !== "string" ||
        !n.text.length ||
        "content" in n ||
        "attrs" in n
      )
        return false;
    } else if ("text" in n || "marks" in n) return false;
    if ("attrs" in n) {
      if (!object(n.attrs)) return false;
      if (t === "heading") {
        if (
          Object.keys(n.attrs).some((k) => k !== "level") ||
          ![1, 2, 3].includes(n.attrs.level as number)
        )
          return false;
      } else if (t === "orderedList") {
        const start = n.attrs.start;
        if (
          Object.keys(n.attrs).some((k) => !["start", "type"].includes(k)) ||
          (n.attrs.type != null && n.attrs.type !== "1") ||
          typeof start !== "number" ||
          !Number.isInteger(start) ||
          start < 1 ||
          start > 100000
        )
          return false;
      } else if (Object.keys(n.attrs).length) return false;
    } else if (t === "heading") return false;
    if ("marks" in n) {
      if (!Array.isArray(n.marks) || n.marks.length > 5) return false;
      for (const m of n.marks) {
        if (
          !object(m) ||
          Object.keys(m).some((k) => !["type", "attrs"].includes(k)) ||
          !["bold", "italic", "underline", "code", "link"].includes(
            m.type as string,
          )
        )
          return false;
        if (m.type === "link") {
          const a = m.attrs;
          if (
            !object(a) ||
            Object.keys(a).some(
              (k) => !["href", "target", "rel", "class", "title"].includes(k),
            ) ||
            typeof a.href !== "string" ||
            !safeNoteLink(a.href)
          )
            return false;
          if (
            (a.target != null && a.target !== "_blank") ||
            (a.rel != null && a.rel !== "noopener noreferrer nofollow") ||
            a.class != null ||
            (a.title != null &&
              (typeof a.title !== "string" || a.title.length > 160))
          )
            return false;
        } else if (
          "attrs" in m &&
          (!object(m.attrs) || Object.keys(m.attrs).length)
        )
          return false;
      }
    }
    if (
      "content" in n &&
      (!Array.isArray(n.content) ||
        !n.content.every((c) => node(c, t, depth + 1)))
    )
      return false;
    if (
      ["doc", "bulletList", "orderedList", "listItem", "blockquote"].includes(t)
    ) {
      if (!Array.isArray(n.content) || !n.content.length) return false;
      if (
        t === "listItem" &&
        (!object(n.content[0]) || n.content[0].type !== "paragraph")
      )
        return false;
    }
    return true;
  }
  return node(value);
}
export const noteInput = z.object({
  id: z.uuid(),
  semester_id: z.uuid(),
  course_id: z.uuid().nullable(),
  revision: z.number().int().nonnegative(),
  request_id: z.uuid(),
  deleted: z.boolean(),
  title: z.string().trim().min(1, "Give your note a title.").max(160),
  content: z.custom<NonNullable<Json>>(
    validNoteContent,
    "This note contains unsupported formatting or is too large.",
  ),
});
export type NoteInput = z.infer<typeof noteInput>;
export type NoteResult =
  | { revision: number; savedAt?: string; error?: never }
  | { error: string; revision?: never; savedAt?: never };
