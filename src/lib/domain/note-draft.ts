import { type Note, type NoteInput, type NoteResult } from "./notes";
// A layout-owned draft survives route unmounts, including browser back/forward.
// Requests are serialized; an ambiguous failure retries the identical receipt.
export class NoteDraft {
  state: {
    note: Note | null;
    dirty: boolean;
    saving: boolean;
    error: string;
    deleted: boolean;
    saved: Note[];
    removed: string[];
  } = {
    note: null,
    dirty: false,
    saving: false,
    error: "",
    deleted: false,
    saved: [],
    removed: [],
  };
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<boolean>;
  private receipt?: { input: NoteInput; generation: number };
  private generation = 0;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  constructor(
    private save: (input: NoteInput) => Promise<NoteResult>,
    private delay = 700,
  ) {}
  private publish(patch: Partial<NoteDraft["state"]>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  open(note: Note) {
    if (this.state.dirty || this.state.saving) return false;
    this.receipt = undefined;
    this.publish({ note, error: "", deleted: false });
    return true;
  }
  edit(patch: Partial<Pick<Note, "title" | "content" | "course_id">>) {
    if (!this.state.note || this.state.deleted) return;
    this.generation++;
    this.publish({ note: { ...this.state.note, ...patch }, dirty: true });
    clearTimeout(this.timer);
    if (!this.state.error)
      this.timer = setTimeout(() => {
        void this.flush();
      }, this.delay);
  }
  create(note: Note) {
    if (!this.open(note)) return;
    this.edit({ title: note.title });
  }
  flush = (): Promise<boolean> => {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    this.running = this.perform().finally(() => {
      this.running = undefined;
    });
    return this.running;
  };
  private async perform() {
    while (this.state.dirty && this.state.note) {
      const n = this.state.note;
      this.receipt ??= {
        generation: this.generation,
        input: {
          id: n.id,
          semester_id: n.semester_id,
          course_id: n.course_id,
          title: n.title,
          content: n.content,
          revision: n.revision,
          request_id: crypto.randomUUID(),
          deleted: this.state.deleted,
        },
      };
      const sent = this.receipt;
      this.publish({ saving: true, error: "" });
      let result: NoteResult;
      try {
        result = await this.save(sent.input);
      } catch {
        result = {
          error:
            "Connection interrupted. Your draft is kept here. Retry to confirm the save.",
        };
      }
      if (result.error) {
        // Definitive validation/conflict failures can be corrected in-place.
        // Network failures keep the exact receipt for an ambiguous committed save.
        if (!result.error.startsWith("Connection interrupted"))
          this.receipt = undefined;
        this.publish({ saving: false, error: result.error });
        return false;
      }
      this.receipt = undefined;
      if (sent.input.deleted) {
        this.publish({
          note: null,
          dirty: false,
          saving: false,
          error: "",
          deleted: false,
          removed: [...this.state.removed, sent.input.id],
          saved: this.state.saved.filter((n) => n.id !== sent.input.id),
        });
      } else {
        const saved = {
          ...this.state.note!,
          title: sent.input.title.trim(),
          content: sent.input.content,
          course_id: sent.input.course_id,
          revision: result.revision!,
          updated_at: result.savedAt ?? new Date().toISOString(),
        };
        this.publish({
          saved: [...this.state.saved.filter((n) => n.id !== saved.id), saved],
          note: {
            ...this.state.note!,
            revision: result.revision!,
            updated_at: saved.updated_at,
          },
          dirty: this.generation !== sent.generation,
          saving: false,
          error: "",
        });
      }
    }
    return true;
  }
  async remove() {
    if (!(await this.flush()) || !this.state.note) return false;
    this.generation++;
    this.publish({ deleted: true, dirty: true });
    return this.flush();
  }
  discard() {
    if (this.state.saving) return;
    clearTimeout(this.timer);
    this.receipt = undefined;
    this.publish({ note: null, dirty: false, error: "", deleted: false });
  }
}
