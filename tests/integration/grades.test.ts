import { beforeEach, afterEach, it, expect } from "vitest";
import { localClients, createTestUser } from "../helpers/local-supabase";
const clients = localClients();
let a: Awaited<ReturnType<typeof createTestUser>>, b: typeof a;
let term: string, other: string, course: string;
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
const fields = {
  name: "Exam",
  weight: "20",
  score_earned: "18",
  score_possible: "20",
  due_date: "2026-10-04",
  due_time: "12:30",
  notes: "Revision",
};
const args = (id = crypto.randomUUID(), revision = 0, payload = fields) => ({
  p_request: crypto.randomUUID(),
  p_id: id,
  p_semester: term,
  p_course: course,
  p_revision: revision,
  p_delete: false,
  p_payload: payload,
});
it("assessment CRUD, clearing scores and persistence across sessions", async () => {
  const v = args();
  expect((await a.client.rpc("change_assessment", v)).error).toBeNull();
  expect((await a.client.rpc("change_assessment", v)).error).toBeNull();
  expect(
    (
      await a.client.rpc(
        "change_assessment",
        args(v.p_id, 1, { ...fields, score_earned: "", due_time: "" }),
      )
    ).error,
  ).toBeNull();
  const fresh = clients.client();
  await fresh.auth.signInWithPassword({ email: a.email, password: a.password });
  const row = (
    await fresh.from("assessments").select("*").eq("id", v.p_id).single()
  ).data!;
  expect(row.score_earned).toBeNull();
  expect(row.due_time).toBeNull();
  expect(row.due_date).toBe(fields.due_date);
  expect(row.revision).toBe(2);
  expect(
    (await a.client.rpc("change_assessment", args(v.p_id, 1))).error,
  ).not.toBeNull();
  expect(
    (
      await a.client.rpc("change_assessment", {
        ...args(v.p_id, 2),
        p_delete: true,
      })
    ).error,
  ).toBeNull();
  expect((await fresh.from("assessments").select("*")).data).toHaveLength(0);
});
it("serializes competing weights and rejects invalid numeric inputs", async () => {
  for (const patch of [
    { weight: "0" },
    { weight: "1.00001" },
    { score_possible: "0" },
    { score_earned: "21" },
    { score_earned: "NaN" },
    { weight: "Infinity" },
  ])
    expect(
      (
        await a.client.rpc(
          "change_assessment",
          args(undefined, 0, { ...fields, ...patch }),
        )
      ).error,
    ).not.toBeNull();
  const results = await Promise.all(
    [60, 60].map((weight) =>
      a.client.rpc(
        "change_assessment",
        args(undefined, 0, { ...fields, weight: String(weight) }),
      ),
    ),
  );
  expect(results.filter((r) => !r.error)).toHaveLength(1);
  expect((await a.client.from("assessments").select("*")).data).toHaveLength(1);
});
it("isolates owners and semesters, protects course deletion and archived history", async () => {
  const v = args();
  expect((await a.client.rpc("change_assessment", v)).error).toBeNull();
  expect((await b.client.from("assessments").select("*")).data).toHaveLength(0);
  expect(
    (
      await b.client.rpc("change_assessment", {
        ...v,
        p_request: crypto.randomUUID(),
        p_revision: 1,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await a.client.rpc("change_assessment", { ...args(), p_semester: other }))
      .error,
  ).not.toBeNull();
  expect(
    (await a.client.from("assessments").update({ weight: 90 }).eq("id", v.p_id))
      .error,
  ).not.toBeNull();
  expect(
    (
      await a.client.rpc("delete_academic", {
        p_id: course,
        p_semester: term,
        p_revision: 1,
        p_kind: "course",
      })
    ).error?.message,
  ).toContain("assessments_course_history");
  expect(
    (
      await a.client.rpc("archive_semester", {
        p_id: term,
        p_revision: 1,
        p_archive: true,
      })
    ).error,
  ).toBeNull();
  expect(
    (await a.client.rpc("change_assessment", args(v.p_id, 1))).error,
  ).not.toBeNull();
  expect((await a.client.from("assessments").select("*")).data).toHaveLength(1);
});
it("preserves decimal storage, independent courses, and private receipts", async () => {
  const v = args(undefined, 0, {
    ...fields,
    weight: "25.5",
    score_earned: "21.3",
    score_possible: "25.25",
  });
  expect((await a.client.rpc("change_assessment", v)).error).toBeNull();
  const row = (
    await a.client.from("assessments").select("*").eq("id", v.p_id).single()
  ).data!;
  expect(row).toMatchObject({
    weight: 25.5,
    score_earned: 21.3,
    score_possible: 25.25,
    due_time: "12:30:00",
  });
  expect(
    (await a.client.from("assessment_operations").select("*")).error,
  ).not.toBeNull();
  expect(
    (await clients.client().from("assessments").select("*")).error,
  ).not.toBeNull();
  expect(
    (
      await a.client.rpc("change_assessment", {
        ...v,
        p_payload: { ...v.p_payload, name: "Changed receipt" },
      })
    ).error,
  ).not.toBeNull();
  const second = crypto.randomUUID();
  expect(
    (
      await a.client.rpc("save_course", {
        p_id: second,
        p_semester: term,
        p_revision: 0,
        p_code: "ENG",
        p_name: "English",
        p_color: "#79c5ab",
        p_instructor: "",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc("change_assessment", {
        ...args(undefined, 0, { ...fields, weight: "100" }),
        p_course: second,
      })
    ).error,
  ).toBeNull();
  expect(
    (await a.client.from("assessments").select("*").eq("course_id", course))
      .data,
  ).toHaveLength(1);
});
