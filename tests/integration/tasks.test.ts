import { beforeEach, afterEach, it, expect } from "vitest";
import { localClients, createTestUser } from "../helpers/local-supabase";
import type { Json } from "../../src/lib/supabase/database.types";
const clients = localClients();
let a: Awaited<ReturnType<typeof createTestUser>>, b: typeof a;
let term: string, other: string, course: string;
const fields = {
  title: "Read chapter",
  description: "Pages 1–10",
  due_date: "2026-10-04",
  due_time: "12:00",
  course_id: "",
  priority: "high",
};
beforeEach(async () => {
  a = await createTestUser(clients);
  b = await createTestUser(clients);
  term = crypto.randomUUID();
  other = crypto.randomUUID();
  course = crypto.randomUUID();
  for (const u of [a, b])
    await u.client.rpc("save_profile", {
      p_name: "Tasks",
      p_timezone: "Asia/Riyadh",
      p_revision: 0,
    });
  for (const id of [term, other])
    await a.client.rpc("create_semester", {
      p_id: id,
      p_name: "Term",
      p_start: "2026-09-01",
      p_end: "2026-12-31",
    });
  await a.client.rpc("save_course", {
    p_id: course,
    p_semester: term,
    p_revision: 0,
    p_code: "M101",
    p_name: "Math",
    p_color: "#79c5ab",
    p_instructor: "",
  });
});
afterEach(async () => {
  for (const u of [a, b])
    if (u)
      expect(
        (await clients.admin.auth.admin.deleteUser(u.id)).error,
      ).toBeNull();
});
const args = (
  id = crypto.randomUUID(),
  revision = 0,
  payload: Json = fields,
  operation = "save",
  semester = term,
) => ({
  p_request: crypto.randomUUID(),
  p_id: id,
  p_semester: semester,
  p_revision: revision,
  p_operation: operation,
  p_payload: payload,
});
async function read(id: string) {
  return (await a.client.from("tasks").select("*").eq("id", id).single()).data!;
}
it("task CRUD and session persistence preserve independent task records", async () => {
  const v = args();
  expect((await a.client.rpc("change_task", v)).error).toBeNull();
  let t = await read(v.p_id);
  expect(t.title).toBe(fields.title);
  expect(t.priority).toBe("high");
  expect(t.due_time).toBe("12:00:00");
  expect(
    (
      await a.client.rpc(
        "change_task",
        args(t.id, t.revision, {
          ...fields,
          title: "Updated",
          due_date: "",
          due_time: "",
          course_id: course,
        }),
      )
    ).error,
  ).toBeNull();
  const fresh = clients.client();
  await fresh.auth.signInWithPassword({ email: a.email, password: a.password });
  const persisted = (
    await fresh.from("tasks").select("*").eq("id", t.id).single()
  ).data!;
  expect(persisted.title).toBe("Updated");
  expect(persisted.due_date).toBeNull();
  expect(persisted.course_id).toBe(course);
  expect(
    (await a.client.from("calendar_events").select("*")).data,
  ).toHaveLength(0);
  t = await read(t.id);
  expect(
    (await a.client.rpc("change_task", args(t.id, t.revision, {}, "delete")))
      .error,
  ).toBeNull();
  expect((await fresh.from("tasks").select("*")).data).toHaveLength(0);
});
it("completion is idempotent, edits retain timestamps and reopening clears completion", async () => {
  const v = args();
  await a.client.rpc("change_task", v);
  const complete = args(v.p_id, 1, { completed: true }, "complete");
  expect((await a.client.rpc("change_task", complete)).error).toBeNull();
  const t = await read(v.p_id);
  expect(t.completed_at).not.toBeNull();
  await a.client.rpc("change_task", complete);
  expect(await read(t.id)).toEqual(t);
  await a.client.rpc(
    "change_task",
    args(t.id, t.revision, { ...fields, title: "Corrected" }),
  );
  expect((await read(t.id)).completed_at).toBe(t.completed_at);
  await a.client.rpc(
    "change_task",
    args(t.id, 3, { completed: false }, "complete"),
  );
  expect((await read(t.id)).completed_at).toBeNull();
  await a.client.rpc(
    "change_task",
    args(t.id, 4, { completed: true }, "complete"),
  );
  expect(Date.parse((await read(t.id)).completed_at!)).toBeGreaterThanOrEqual(
    Date.parse(t.completed_at!),
  );
});
it("RLS denies cross-user access, raw writes, forged parents and anonymous RPCs", async () => {
  const v = args();
  await a.client.rpc("change_task", v);
  expect((await b.client.from("tasks").select("*")).data).toEqual([]);
  for (const client of [b.client, clients.client()])
    expect(
      (
        await client.rpc(
          "change_task",
          args(v.p_id, 1, { completed: true }, "complete"),
        )
      ).error,
    ).not.toBeNull();
  expect(
    (await a.client.from("tasks").update({ title: "Bypass" }).eq("id", v.p_id))
      .error,
  ).not.toBeNull();
  expect((await b.client.rpc("change_task", args())).error).not.toBeNull();
  expect(
    (
      await a.client.rpc(
        "change_task",
        args(undefined, 0, { ...fields, course_id: course }, "save", other),
      )
    ).error,
  ).not.toBeNull();
  expect(
    (await a.client.from("task_operations").select("*")).error,
  ).not.toBeNull();
});
it("stale concurrent edits cannot overwrite and retry payload changes are rejected", async () => {
  const v = args();
  await a.client.rpc("change_task", v);
  const results = await Promise.all([
    a.client.rpc("change_task", args(v.p_id, 1, { ...fields, title: "One" })),
    a.client.rpc("change_task", args(v.p_id, 1, { ...fields, title: "Two" })),
  ]);
  expect(results.filter((r) => !r.error)).toHaveLength(1);
  expect((await read(v.p_id)).revision).toBe(2);
  expect(
    (
      await a.client.rpc("change_task", {
        ...v,
        p_payload: { ...fields, title: "Changed retry" },
      })
    ).error,
  ).not.toBeNull();
});
it("course deletion detaches tasks; semester queries and archived history remain safe", async () => {
  const v = args(undefined, 0, { ...fields, course_id: course });
  await a.client.rpc("change_task", v);
  await a.client.rpc("change_task", args(undefined, 0, fields, "save", other));
  expect(
    (await a.client.from("tasks").select("*").eq("semester_id", term)).data,
  ).toHaveLength(1);
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
  const t = await read(v.p_id);
  expect(t.course_id).toBeNull();
  expect(t.title).toBe(fields.title);
  const sem = (
    await a.client.from("semesters").select("*").eq("id", term).single()
  ).data!;
  expect(
    (
      await a.client.rpc("archive_semester", {
        p_id: term,
        p_revision: sem.revision,
        p_archive: true,
      })
    ).error,
  ).toBeNull();
  for (const op of ["save", "complete", "delete"])
    expect(
      (
        await a.client.rpc(
          "change_task",
          args(
            t.id,
            t.revision,
            op === "complete" ? { completed: true } : fields,
            op,
          ),
        )
      ).error,
    ).not.toBeNull();
  expect((await read(t.id)).title).toBe(fields.title);
});
it("database validates due values, optional fields, title and priority", async () => {
  expect(
    (
      await a.client.rpc(
        "change_task",
        args(undefined, 0, {
          ...fields,
          due_date: "",
          due_time: "",
          description: "",
          course_id: "",
        }),
      )
    ).error,
  ).toBeNull();
  for (const f of [
    { title: " " },
    { due_date: "", due_time: "10:00" },
    { due_time: "24:00" },
    { due_date: "infinity" },
    { priority: "urgent" },
    { due_time: "12:00:30" },
  ])
    expect(
      (
        await a.client.rpc(
          "change_task",
          args(undefined, 0, { ...fields, ...f }),
        )
      ).error,
    ).not.toBeNull();
});
