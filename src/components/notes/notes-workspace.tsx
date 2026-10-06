"use client";
import { useActionNotification } from "@/components/ui/action-notifications";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import type { Course, Semester, Json } from "@/lib/supabase/database.types";
import { emptyNote, type Note } from "@/lib/domain/notes";
import { Button, IconButton } from "@/components/ui/primitives";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { useNoteDraft } from "./draft-provider";
import { NoteEditor } from "./note-editor";
export function NotesWorkspace({
  notes,
  loadedAt,
  courses,
  semester,
  zone,
}: {
  notes: Note[];
  loadedAt: string;
  courses: Course[];
  semester: Semester;
  zone: string;
}) {
  const { store, state } = useNoteDraft();
  const router = useRouter();
  const notify = useActionNotification();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirm, setConfirm] = useState<"delete" | "reload" | null>(null);
  const [opening, setOpening] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const archived = !!semester.archived_at;
  const active = state.note?.semester_id === semester.id ? state.note : null;
  const map = new Map(notes.map((n) => [n.id, n]));
  for (const n of state.saved)
    if (
      n.semester_id === semester.id &&
      n.updated_at >= loadedAt &&
      (!map.has(n.id) || map.get(n.id)!.revision < n.revision)
    )
      map.set(n.id, n);
  for (const id of state.removed) map.delete(id);
  // Keep a dirty draft visible even when the saved title or course is different.
  if (
    active &&
    (state.dirty ||
      (map.has(active.id) && map.get(active.id)!.revision <= active.revision))
  )
    map.set(active.id, active);
  const missing = !!active && !state.dirty && !map.has(active.id);
  const readOnly = archived || missing;
  const all = [...map.values()].sort(
    (a, b) =>
      b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id),
  );
  const filtered = all.filter(
    (n) =>
      n.title
        .toLocaleLowerCase("en")
        .includes(search.toLocaleLowerCase("en")) &&
      (filter === "all" ||
        (filter === "none" ? !n.course_id : n.course_id === filter)),
  );
  async function open(note?: Note) {
    setOpening(true);
    if (await store.flush()) {
      if (note) {
        const latest = store.state.saved.find(
          (n) => n.id === note.id && n.revision >= note.revision,
        );
        store.open(latest ?? note);
      } else {
        const now = new Date().toISOString();
        store.create({
          id: crypto.randomUUID(),
          owner_id: semester.owner_id,
          semester_id: semester.id,
          course_id: filter !== "all" && filter !== "none" ? filter : null,
          title: "Untitled note",
          content: emptyNote,
          revision: 0,
          created_at: now,
          updated_at: now,
        });
        setSearch("");
      }
      setEditorVersion((v) => v + 1);
    }
    setOpening(false);
  }
  const remote =
    active &&
    notes.find((n) => n.id === active.id && n.revision > active.revision);
  return (
    <div className="page-enter notes-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Notes</h1>
          <p className="page-subtitle">{semester.name}</p>
        </div>
        {!archived && (
          <Button
            variant="primary"
            disabled={opening || state.saving}
            onClick={() => void open()}
          >
            <Plus size={16} />
            New note
          </Button>
        )}
      </div>
      {state.note && !active && state.dirty && (
        <div role="alert" className="form-error">
          An unsaved note belongs to another semester. Return to that semester
          to resolve it.
        </div>
      )}
      <div className="notes-workspace">
        <section className="note-library" aria-label="Note library">
          <div className="note-filters">
            <input
              aria-label="Search note titles"
              type="search"
              placeholder="Search titles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Course filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All courses</option>
              <option value="none">Without a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="note-list" aria-label="Notes">
            {filtered.map((n) => (
              <button
                type="button"
                key={n.id}
                className={`note-list-item ${active?.id === n.id ? "is-selected" : ""}`}
                aria-current={active?.id === n.id ? "true" : undefined}
                disabled={opening || state.saving}
                onClick={() => void open(n)}
              >
                <strong>{n.title || "Untitled note"}</strong>
                <span>
                  {courses.find((c) => c.id === n.course_id)?.code ??
                    "Personal note"}
                </span>
                <time dateTime={n.updated_at}>
                  {new Intl.DateTimeFormat("en", {
                    timeZone: zone,
                    month: "short",
                    day: "numeric",
                  }).format(new Date(n.updated_at))}
                </time>
              </button>
            ))}
            {!filtered.length && (
              <p className="note-list-empty">
                {all.length ? "No matching notes." : "No notes yet."}
              </p>
            )}
            {notes.length === 1000 && (
              <p className="field-help">Showing the 1,000 most recent notes.</p>
            )}
          </div>
        </section>
        <section className="note-detail" aria-label="Note editor">
          {active ? (
            <div data-note-dirty={state.dirty}>
              <div className="note-meta">
                <label className="note-course">
                  Course
                  <select
                    aria-label="Note course"
                    disabled={readOnly || state.deleted}
                    value={active.course_id ?? ""}
                    onChange={(e) =>
                      store.edit({ course_id: e.target.value || null })
                    }
                  >
                    <option value="">No course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span role="status" className="note-save-status">
                  {archived
                    ? "Archived · Read only"
                    : state.saving
                      ? "Saving…"
                      : state.error
                        ? "Not saved"
                        : state.dirty
                          ? "Unsaved changes"
                          : "Saved"}
                </span>
                {!readOnly && (
                  <IconButton
                    label="Delete note"
                    disabled={state.saving}
                    onClick={() => setConfirm("delete")}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>
              {missing && (
                <div className="note-save-error" role="status">
                  This note was deleted in another session. Its last opened
                  content remains here for reference.
                </div>
              )}
              {state.error && (
                <div className="note-save-error" role="alert">
                  {state.error}
                  <div>
                    <Button
                      disabled={state.saving}
                      onClick={() => void store.flush()}
                    >
                      Retry save
                    </Button>
                    <Button
                      disabled={state.saving}
                      onClick={() => setConfirm("reload")}
                    >
                      Reload saved note
                    </Button>
                  </div>
                </div>
              )}
              {remote && !state.dirty && (
                <div className="note-save-error">
                  A newer version is available.{" "}
                  <Button
                    onClick={() => {
                      store.open(remote);
                      setEditorVersion((v) => v + 1);
                    }}
                  >
                    Load latest version
                  </Button>
                </div>
              )}
              <input
                className="note-title"
                aria-label="Note title"
                maxLength={160}
                value={active.title}
                readOnly={readOnly || state.deleted}
                onChange={(e) => store.edit({ title: e.target.value })}
              />
              <NoteEditor
                key={`${active.id}-${editorVersion}-${readOnly}`}
                content={active.content as JSONContent}
                readOnly={readOnly || state.deleted}
                onChange={(content) =>
                  store.edit({ content: content as NonNullable<Json> })
                }
              />
            </div>
          ) : (
            <div className="note-editor-empty">
              <FileText size={28} strokeWidth={1.4} />
              <h2>{all.length ? "Select a note" : "Your semester notes"}</h2>
              <p>
                {all.length
                  ? "Choose a note to open it here."
                  : "Keep lecture notes and ideas together, with or without a course."}
              </p>
              {!all.length && !archived && (
                <Button onClick={() => void open()} disabled={opening}>
                  Create a note
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
      {confirm && (
        <EditorDialog
          title={confirm === "delete" ? "Delete note?" : "Reload saved note?"}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "delete"
              ? "This permanently deletes this note and its content."
              : "This discards your local draft and loads the saved version. Copy any text you want to keep first."}
          </p>
          <div className="form-actions">
            <Button
              disabled={state.saving}
              onClick={async () => {
                if (confirm === "delete") {
                  if (await store.remove()) {
                    notify({ title: "Note deleted", detail: active?.title });
                    setConfirm(null);
                    router.refresh();
                  } else setConfirm(null);
                } else {
                  store.discard();
                  setConfirm(null);
                  router.refresh();
                }
              }}
              variant="primary"
            >
              {confirm === "delete"
                ? "Delete permanently"
                : "Discard draft and reload"}
            </Button>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
          </div>
        </EditorDialog>
      )}
    </div>
  );
}
