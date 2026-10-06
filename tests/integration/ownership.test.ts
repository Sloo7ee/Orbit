import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { localClients, createTestUser } from "../helpers/local-supabase";
describe("real local Supabase identity and RLS", () => {
  let clients: ReturnType<typeof localClients>;
  let a: Awaited<ReturnType<typeof createTestUser>>;
  let b: typeof a;
  let semester: string;
  beforeAll(async () => {
    clients = localClients();
    a = await createTestUser(clients);
    b = await createTestUser(clients);
    for (const user of [a, b]) {
      const { error } = await user.client.rpc("save_profile", {
        p_name: "Test Owner",
        p_timezone: "Asia/Riyadh",
        p_revision: 0,
      });
      expect(error).toBeNull();
    }
    semester = randomUUID();
    expect(
      (
        await a.client.rpc("create_semester", {
          p_id: semester,
          p_name: "Fall",
          p_start: "2026-09-01",
          p_end: "2026-12-31",
        })
      ).error,
    ).toBeNull();
  });
  afterAll(async () => {
    for (const user of [a, b])
      if (user) await clients.admin.auth.admin.deleteUser(user.id);
  });
  it("persists data into an independent authenticated session", async () => {
    const fresh = clients.client();
    expect(
      (
        await fresh.auth.signInWithPassword({
          email: a.email,
          password: a.password,
        })
      ).error,
    ).toBeNull();
    expect((await fresh.from("semesters").select("*")).data?.[0].name).toBe(
      "Fall",
    );
    expect(
      (await fresh.from("profiles").select("*").single()).data
        ?.selected_semester_id,
    ).toBe(semester);
    expect((await fresh.auth.refreshSession()).error).toBeNull();
    expect((await fresh.auth.getUser()).data.user?.id).toBe(a.id);
  });
  it("blocks anonymous reads and RPC writes", async () => {
    const anon = clients.client();
    expect((await anon.from("semesters").select("*")).error).not.toBeNull();
    expect((await anon.from("profiles").select("*")).error).not.toBeNull();
    expect(
      (await anon.rpc("select_semester", { p_id: semester })).error,
    ).not.toBeNull();
  });
  it("isolates rows and rejects forged ownership and cross-user references", async () => {
    expect(
      (await b.client.from("semesters").select("*").eq("id", semester)).data,
    ).toEqual([]);
    expect(
      (await b.client.from("profiles").select("*").eq("id", a.id)).data,
    ).toEqual([]);
    expect(
      (
        await b.client.from("semesters").insert({
          owner_id: a.id,
          name: "Forged",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b.client
          .from("profiles")
          .update({ selected_semester_id: semester })
          .eq("id", b.id)
      ).error,
    ).not.toBeNull();
    expect(
      (await b.client.rpc("select_semester", { p_id: semester })).error,
    ).not.toBeNull();
    expect(
      (
        await b.client.rpc("archive_semester", {
          p_id: semester,
          p_revision: 1,
          p_archive: true,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b.client
          .from("semesters")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", semester)
          .select()
      ).data,
    ).toEqual([]);
    expect(
      (await a.client.from("semesters").delete().eq("id", semester)).error,
    ).not.toBeNull();
  });
  it("validates dates/timezones at the database boundary", async () => {
    expect(
      (
        await a.client.rpc("create_semester", {
          p_id: randomUUID(),
          p_name: "Bad",
          p_start: "2026-12-31",
          p_end: "2026-01-01",
        })
      ).error,
    ).not.toBeNull();
    const profile = (await a.client.from("profiles").select("*").single())
      .data!;
    expect(
      (
        await a.client.rpc("save_profile", {
          p_name: "Name",
          p_timezone: "Not/AZone",
          p_revision: profile.revision,
        })
      ).error,
    ).not.toBeNull();
  });
  it("detects competing profile edits", async () => {
    const profile = (await a.client.from("profiles").select("*").single())
      .data!;
    const results = await Promise.all(
      ["One", "Two"].map((name) =>
        a.client.rpc("save_profile", {
          p_name: name,
          p_timezone: "UTC",
          p_revision: profile.revision,
        }),
      ),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error)).toHaveLength(1);
  });
  it("makes create retries safe and preserves archive/restore history", async () => {
    expect(
      (
        await a.client.rpc("create_semester", {
          p_id: semester,
          p_name: "Fall",
          p_start: "2026-09-01",
          p_end: "2026-12-31",
        })
      ).error,
    ).toBeNull();
    expect((await a.client.from("semesters").select("*")).data).toHaveLength(1);
    const archived = await a.client.rpc("archive_semester", {
      p_id: semester,
      p_revision: 1,
      p_archive: true,
    });
    expect(archived.error).toBeNull();
    expect(archived.data?.archived_at).toBeTruthy();
    expect(
      (
        await a.client.rpc("archive_semester", {
          p_id: semester,
          p_revision: 1,
          p_archive: true,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await a.client.rpc("archive_semester", {
          p_id: semester,
          p_revision: 1,
          p_archive: false,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await a.client.rpc("archive_semester", {
          p_id: semester,
          p_revision: archived.data!.revision,
          p_archive: false,
        })
      ).data?.archived_at,
    ).toBeNull();
  });
  it("rejects public signup and incorrect passwords", async () => {
    const anon = clients.client();
    expect(
      (
        await anon.auth.signUp({
          email: `blocked-${randomUUID()}@example.test`,
          password: a.password,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await anon.auth.signInWithPassword({
          email: a.email,
          password: "Wrong-password-123",
        })
      ).error,
    ).not.toBeNull();
  });
});
