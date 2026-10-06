import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { localClients, createTestUser } from "../helpers/local-supabase";
const clients = localClients();
let a: Awaited<ReturnType<typeof createTestUser>>, b: typeof a;
const semester = randomUUID(),
  other = randomUUID(),
  course = randomUUID(),
  event = randomUUID();
const courseArgs = {
  p_id: course,
  p_semester: semester,
  p_revision: 0,
  p_code: "M101",
  p_name: "Mathematics",
  p_instructor: "Professor Test",
  p_color: "#a994e8",
};
const eventArgs = {
  p_id: event,
  p_semester: semester,
  p_revision: 0,
  p_title: "Lecture",
  p_start: "2026-10-04T06:00:00Z",
  p_end: "2026-10-04T07:00:00Z",
  p_course: course,
  p_color: "#a994e8",
};
beforeAll(async () => {
  a = await createTestUser(clients);
  b = await createTestUser(clients);
  for (const u of [a, b])
    expect(
      (
        await u.client.rpc("save_profile", {
          p_name: "Test",
          p_timezone: "Asia/Riyadh",
          p_revision: 0,
        })
      ).error,
    ).toBeNull();
  for (const id of [semester, other])
    expect(
      (
        await a.client.rpc("create_semester", {
          p_id: id,
          p_name: "Term",
          p_start: "2026-01-01",
          p_end: "2026-12-31",
        })
      ).error,
    ).toBeNull();
});
afterAll(async () => {
  for (const u of [a, b])
    if (u) {
      const { error } = await clients.admin.auth.admin.deleteUser(u.id);
      if (error) throw error;
    }
});
it("creates, retries, edits and persists courses and events", async () => {
  expect((await a.client.rpc("save_course", courseArgs)).error).toBeNull();
  expect((await a.client.rpc("save_course", courseArgs)).error).toBeNull();
  expect((await a.client.rpc("save_event", eventArgs)).error).toBeNull();
  expect((await a.client.rpc("save_event", eventArgs)).error).toBeNull();
  const fresh = clients.client();
  await fresh.auth.signInWithPassword({ email: a.email, password: a.password });
  expect((await fresh.from("courses").select("*")).data).toHaveLength(1);
  expect((await fresh.from("calendar_events").select("*")).data).toHaveLength(
    1,
  );
  expect(
    (
      await fresh.rpc("save_course", {
        ...courseArgs,
        p_revision: 1,
        p_name: "Calculus",
      })
    ).data?.revision,
  ).toBe(2);
  expect(
    (
      await fresh.rpc("save_event", {
        ...eventArgs,
        p_revision: 1,
        p_end: "2026-10-04T08:00:00Z",
      })
    ).data?.revision,
  ).toBe(2);
  expect(
    (await fresh.rpc("save_event", { ...eventArgs, p_revision: 1 })).error,
  ).not.toBeNull();
});
it("isolates users, semesters and RPCs; denies raw writes and anonymous access", async () => {
  expect((await b.client.from("courses").select("*")).data).toEqual([]);
  expect((await b.client.from("calendar_events").select("*")).data).toEqual([]);
  expect(
    (await b.client.rpc("save_course", { ...courseArgs, p_revision: 2 })).error,
  ).not.toBeNull();
  expect(
    (await b.client.rpc("save_event", { ...eventArgs, p_revision: 2 })).error,
  ).not.toBeNull();
  await b.client.rpc("delete_academic", {
    p_kind: "event",
    p_id: event,
    p_semester: semester,
    p_revision: 2,
  });
  expect(
    (await a.client.from("calendar_events").select("*")).data,
  ).toHaveLength(1);
  expect(
    (
      await a.client
        .from("calendar_events")
        .select("*")
        .eq("semester_id", other)
    ).data,
  ).toEqual([]);
  expect(
    (
      await a.client.rpc("save_event", {
        ...eventArgs,
        p_id: randomUUID(),
        p_semester: other,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await a.client.from("courses").update({ name: "Bypass" }).eq("id", course))
      .error,
  ).not.toBeNull();
  expect(
    (await clients.client().from("calendar_events").select("*")).error,
  ).not.toBeNull();
  expect(
    (await clients.client().rpc("save_event", eventArgs)).error,
  ).not.toBeNull();
});
it("rejects invalid intervals, freezes archived history, restores then detaches safely on deletion", async () => {
  expect(
    (
      await a.client.rpc("save_event", {
        ...eventArgs,
        p_id: randomUUID(),
        p_end: eventArgs.p_start,
      })
    ).error,
  ).not.toBeNull();
  const archived = await a.client.rpc("archive_semester", {
    p_id: semester,
    p_revision: 1,
    p_archive: true,
  });
  expect(archived.error).toBeNull();
  expect(
    (await a.client.rpc("save_event", { ...eventArgs, p_revision: 2 })).error,
  ).not.toBeNull();
  expect(
    (await a.client.rpc("save_course", { ...courseArgs, p_revision: 2 })).error,
  ).not.toBeNull();
  expect(
    (
      await a.client.rpc("delete_academic", {
        p_kind: "course",
        p_id: course,
        p_semester: semester,
        p_revision: 2,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await a.client.from("calendar_events").select("*")).data,
  ).toHaveLength(1);
  expect(
    (
      await a.client.rpc("archive_semester", {
        p_id: semester,
        p_revision: archived.data!.revision,
        p_archive: false,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc("delete_academic", {
        p_kind: "course",
        p_id: course,
        p_semester: semester,
        p_revision: 2,
      })
    ).error,
  ).toBeNull();
  const saved = (await a.client.from("calendar_events").select("*").single())
    .data!;
  expect(saved.course_id).toBeNull();
  expect(saved.color).toBe("#a994e8");
  expect(saved.revision).toBe(3);
  expect(
    (
      await a.client.rpc("delete_academic", {
        p_kind: "event",
        p_id: event,
        p_semester: semester,
        p_revision: 2,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await a.client.rpc("delete_academic", {
        p_kind: "event",
        p_id: event,
        p_semester: semester,
        p_revision: 3,
      })
    ).error,
  ).toBeNull();
  expect((await a.client.from("calendar_events").select("*")).data).toEqual([]);
});

it("allows administrative account cleanup including archived academic history", async () => {
  const user = await createTestUser(clients),
    sid = randomUUID(),
    cid = randomUUID();
  await user.client.rpc("save_profile", {
    p_name: "Cleanup",
    p_timezone: "UTC",
    p_revision: 0,
  });
  await user.client.rpc("create_semester", {
    p_id: sid,
    p_name: "Cleanup",
    p_start: "2026-01-01",
    p_end: "2026-12-31",
  });
  await user.client.rpc("save_course", {
    ...courseArgs,
    p_id: cid,
    p_semester: sid,
  });
  await user.client.rpc("save_event", {
    ...eventArgs,
    p_id: randomUUID(),
    p_semester: sid,
    p_course: cid,
  });
  await user.client.rpc("archive_semester", {
    p_id: sid,
    p_revision: 1,
    p_archive: true,
  });
  expect((await clients.admin.auth.admin.deleteUser(user.id)).error).toBeNull();
  expect(
    (
      await clients.admin
        .from("calendar_events")
        .select("*")
        .eq("owner_id", user.id)
    ).data,
  ).toEqual([]);
});
