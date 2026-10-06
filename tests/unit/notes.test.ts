import { describe, it, expect, vi } from "vitest";
import {
  emptyNote,
  validNoteContent,
  safeNoteLink,
  type Note,
  type NoteInput,
  type NoteResult,
} from "../../src/lib/domain/notes";
import { NoteDraft } from "../../src/lib/domain/note-draft";
const n = (): Note => ({
  id: crypto.randomUUID(),
  owner_id: crypto.randomUUID(),
  semester_id: crypto.randomUUID(),
  course_id: null,
  title: "Lecture",
  content: emptyNote,
  revision: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
describe("restricted note documents", () => {
  it("accepts requested blocks and formatting; rejects unsafe links and foreign structure", () => {
    expect(validNoteContent(emptyNote)).toBe(true);
    for (const type of ["bold", "italic", "underline", "code", "link"])
      expect(
        validNoteContent({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Study",
                  marks: [
                    {
                      type,
                      ...(type === "link"
                        ? {
                            attrs: { href: "https://example.com", title: null },
                          }
                        : {}),
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ).toBe(true);
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,test",
      "https://a\nb",
      "//example.com",
    ])
      expect(safeNoteLink(href)).toBe(false);
    for (const bad of [
      { type: null },
      { type: "doc", content: [{ type: "text", text: "bad" }] },
      { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
      { type: "doc", content: [{ type: "heading", attrs: { level: 4 } }] },
      {
        type: "doc",
        content: [{ type: "paragraph", attrs: { onclick: "evil" } }],
      },
    ])
      expect(validNoteContent(bad)).toBe(false);
  });
});
describe("serialized autosave", () => {
  it("debounces edits and preserves newer typing during a pending save", async () => {
    vi.useFakeTimers();
    let resolve!: (v: NoteResult) => void;
    const save = vi
      .fn<(i: NoteInput) => Promise<NoteResult>>()
      .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
      .mockResolvedValue({ revision: 3 });
    const store = new NoteDraft(save);
    store.open(n());
    store.edit({ title: "A" });
    await vi.advanceTimersByTimeAsync(400);
    store.edit({ title: "B" });
    await vi.advanceTimersByTimeAsync(699);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    store.edit({ title: "C" });
    resolve({ revision: 2 });
    await store.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ title: "C", revision: 2 });
    expect(store.state.dirty).toBe(false);
    vi.useRealTimers();
  });
  it("retries an identical ambiguous receipt before saving newer edits", async () => {
    const save = vi
      .fn<(i: NoteInput) => Promise<NoteResult>>()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValueOnce({ revision: 2 })
      .mockResolvedValueOnce({ revision: 3 });
    const store = new NoteDraft(save);
    store.open(n());
    store.edit({ title: "First" });
    expect(await store.flush()).toBe(false);
    expect(store.open(n())).toBe(false);
    store.edit({ title: "Second" });
    expect(await store.flush()).toBe(true);
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
    expect(save.mock.calls[2][0]).toMatchObject({
      title: "Second",
      revision: 2,
    });
  });
  it("keeps stale drafts and never advances their revision on a rejection", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ error: "This note changed in another session." });
    const store = new NoteDraft(save);
    const note = n();
    store.open(note);
    store.edit({ title: "My text" });
    await store.flush();
    expect(store.state.note).toMatchObject({ title: "My text", revision: 1 });
    expect(store.state.dirty).toBe(true);
    expect(store.open(n())).toBe(false);
    store.discard();
    expect(store.state.note).toBeNull();
  });
});
