import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localClients, createTestUser } from "../helpers/local-supabase";
import { emptyNote } from "../../src/lib/domain/notes";
const clients = localClients();
let a: Awaited<ReturnType<typeof createTestUser>>, b: typeof a;
const term = crypto.randomUUID(),
  other = crypto.randomUUID(),
  course = crypto.randomUUID();
beforeAll(async () => {
  a = await createTestUser(clients);
  b = await createTestUser(clients);
  for (const u of [a, b]) {
    expect(
      (
        await u.client.rpc("save_profile", {
          p_name: "Notes tester",
          p_timezone: "Asia/Riyadh",
          p_revision: 0,
        })
      ).error,
    ).toBeNull();
  }
  for (const [u, id] of [
    [a, term],
    [b, other],
  ] as const)
    expect(
      (
        await u.client.rpc("create_semester", {
          p_id: id,
          p_name: "Notes term",
          p_start: "2026-01-01",
          p_end: "2026-12-31",
        })
      ).error,
    ).toBeNull();
  expect(
    (
      await a.client.rpc("save_course", {
        p_id: course,
        p_semester: term,
        p_revision: 0,
        p_code: "SCI",
        p_name: "Science",
        p_instructor: "",
        p_color: "#79c5ab",
      })
    ).error,
  ).toBeNull();
});
afterAll(async () => {
  for (const u of [a, b])
    if (u) await clients.admin.auth.admin.deleteUser(u.id);
});
const input = () => ({
  p_request: crypto.randomUUID(),
  p_id: crypto.randomUUID(),
  p_semester: term,
  p_course: null as string | null,
  p_revision: 0,
  p_delete: false,
  p_title: "Lecture",
  p_content: emptyNote,
});
describe("Notes persistence and security", () => {
  it("creates, edits, retries, rejects stale writes, deletes and preserves session persistence", async () => {
    const p = input();
    expect((await a.client.rpc("change_note", p)).data).toBe(1);
    expect((await a.client.rpc("change_note", p)).data).toBe(1);
    const edit = {
      ...p,
      p_request: crypto.randomUUID(),
      p_revision: 1,
      p_title: "Revised",
      p_course: course,
    };
    expect((await a.client.rpc("change_note", edit)).data).toBe(2);
    expect(
      (
        await a.client.rpc("change_note", {
          ...edit,
          p_request: crypto.randomUUID(),
          p_title: "Stale",
        })
      ).error?.message,
    ).toContain("changed");
    expect(
      (
        await a.client.rpc("change_note", {
          ...edit,
          p_title: "Altered receipt",
        })
      ).error?.message,
    ).toContain("Request changed");
    await a.client.auth.signOut();
    await a.client.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    expect(
      (await a.client.from("notes").select("*").eq("id", p.p_id).single()).data,
    ).toMatchObject({ title: "Revised", revision: 2, course_id: course });
    expect(
      (
        await a.client.rpc("change_note", {
          ...p,
          p_request: crypto.randomUUID(),
          p_revision: 2,
          p_delete: true,
        })
      ).error,
    ).toBeNull();
    expect(
      (await a.client.from("notes").select("*").eq("id", p.p_id)).data,
    ).toEqual([]);
  });
  it("isolates two owners and semesters and blocks direct writes/receipt access", async () => {
    const p = input();
    expect((await a.client.rpc("change_note", p)).error).toBeNull();
    expect((await b.client.from("notes").select("*")).data).toEqual([]);
    expect(
      (await clients.client().from("notes").select("*")).error,
    ).toBeTruthy();
    expect(
      (
        await b.client.rpc("change_note", {
          ...p,
          p_request: crypto.randomUUID(),
          p_revision: 1,
          p_delete: true,
        })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await b.client.rpc("change_note", {
          ...input(),
          p_semester: other,
          p_course: course,
        })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await a.client
          .from("notes")
          .update({ title: "Bypass" })
          .eq("id", p.p_id)
      ).error,
    ).toBeTruthy();
    expect(
      (await a.client.from("note_operations").select("*")).error,
    ).toBeTruthy();
    const second = crypto.randomUUID();
    await a.client.rpc("create_semester", {
      p_id: second,
      p_name: "Second",
      p_start: "2027-01-01",
      p_end: "2027-12-31",
    });
    expect(
      (
        await a.client.rpc("change_note", {
          ...input(),
          p_semester: second,
          p_course: course,
        })
      ).error,
    ).toBeTruthy();
    expect(
      (await a.client.from("notes").select("*").eq("semester_id", second)).data,
    ).toEqual([]);
  });
  it("rejects unsafe and unsupported JSON through the RPC and direct database constraints", async () => {
    const bads = [
      { type: null },
      { type: "doc", content: [{ type: "image" }] },
      { type: "doc", content: [{ type: "heading", attrs: { level: null } }] },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(210000) }],
          },
        ],
      },
    ];
    for (const content of bads)
      expect(
        (await a.client.rpc("change_note", { ...input(), p_content: content }))
          .error,
      ).toBeTruthy();
    const p = input();
    expect((await a.client.rpc("change_note", p)).error).toBeNull();
    expect(
      (
        await clients.admin
          .from("notes")
          .update({ content: { type: "iframe" } })
          .eq("id", p.p_id)
      ).error,
    ).toBeTruthy();
    const rich = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Lecture" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1, type: null },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Read",
                      marks: [
                        {
                          type: "link",
                          attrs: {
                            href: "https://example.com",
                            target: "_blank",
                            rel: "noopener noreferrer nofollow",
                            class: null,
                            title: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(
      (await a.client.rpc("change_note", { ...input(), p_content: rich }))
        .error,
    ).toBeNull();
  });
  it("preserves notes on course deletion and archived semesters are read-only", async () => {
    const p = { ...input(), p_course: course };
    expect((await a.client.rpc("change_note", p)).error).toBeNull();
    expect(
      (
        await a.client.rpc("delete_academic", {
          p_id: course,
          p_semester: term,
          p_revision: 1,
          p_kind: "course",
        })
      ).error,
    ).toBeNull();
    const row = (
      await a.client.from("notes").select("*").eq("id", p.p_id).single()
    ).data!;
    expect(row.course_id).toBeNull();
    expect(row.content).toEqual(emptyNote);
    expect(row.revision).toBe(2);
    const semester = (
      await a.client.from("semesters").select("*").eq("id", term).single()
    ).data!;
    expect(
      (
        await a.client.rpc("archive_semester", {
          p_id: term,
          p_revision: semester.revision,
          p_archive: true,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await a.client.rpc("change_note", {
          ...input(),
          p_id: p.p_id,
          p_revision: 2,
          p_title: "No edit",
        })
      ).error?.message,
    ).toContain("archived");
    expect(
      (
        await a.client.rpc("change_note", {
          ...input(),
          p_id: p.p_id,
          p_revision: 2,
          p_delete: true,
        })
      ).error?.message,
    ).toContain("archived");
    expect(
      (await a.client.from("notes").select("*").eq("id", p.p_id).single()).data
        ?.title,
    ).toBe("Lecture");
  });
});
