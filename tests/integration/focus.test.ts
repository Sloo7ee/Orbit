import { beforeEach, afterEach, it, expect } from "vitest";
import { DateTime } from "luxon";
import { localClients, createTestUser } from "../helpers/local-supabase";
import type { Json } from "../../src/lib/supabase/database.types";
import type { FocusSnapshot } from "../../src/lib/domain/focus";
const clients = localClients();
let a: Awaited<ReturnType<typeof createTestUser>>, b: typeof a;
let term: string, other: string, course: string, task: string;
beforeEach(async () => {
  a = await createTestUser(clients);
  b = await createTestUser(clients);
  term = crypto.randomUUID();
  other = crypto.randomUUID();
  course = crypto.randomUUID();
  task = crypto.randomUUID();
  for (const u of [a, b])
    expect(
      (
        await u.client.rpc("save_profile", {
          p_name: "Focus tester",
          p_timezone: "Asia/Riyadh",
          p_revision: 0,
        })
      ).error,
    ).toBeNull();
  for (const id of [term, other])
    expect(
      (
        await a.client.rpc("create_semester", {
          p_id: id,
          p_name: "Focus term",
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
        p_code: "MATH",
        p_name: "Math",
        p_color: "#79c5ab",
        p_instructor: "",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc("change_task", {
        p_request: crypto.randomUUID(),
        p_id: task,
        p_semester: term,
        p_revision: 0,
        p_operation: "save",
        p_payload: {
          title: "Study exam",
          description: "",
          priority: "medium",
          course_id: course,
          due_date: "",
          due_time: "",
        },
      })
    ).error,
  ).toBeNull();
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
  operation = "start",
  payload: Json = { mode: "stopwatch" },
) => ({
  p_request: crypto.randomUUID(),
  p_id: id,
  p_semester: term,
  p_revision: revision,
  p_operation: operation,
  p_payload: payload,
});
async function read(id: string) {
  return (
    await a.client.from("focus_sessions").select("*").eq("id", id).single()
  ).data!;
}
async function age(id: string, ms: number) {
  const s = await read(id),
    // Age against the authoritative database clock, not the Docker host clock.
    d = new Date(Date.parse((await snapshot()).server_now) - ms).toISOString();
  expect(
    (
      await clients.admin
        .from("focus_sessions")
        .update({
          segment_started_at: d,
          started_at: new Date(
            Math.min(Date.parse(s.started_at), Date.parse(d)),
          ).toISOString(),
        })
        .eq("id", id)
    ).error,
  ).toBeNull();
  return read(id);
}
async function snapshot() {
  const r = await a.client.rpc("focus_snapshot", { p_semester: term });
  expect(r.error).toBeNull();
  return r.data as unknown as FocusSnapshot;
}
it("stopwatch pause/resume/finish is persistent, revision-safe and retry-safe", async () => {
  const v = args();
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 60000);
  const pause = args(s.id, s.revision, "pause");
  expect((await a.client.rpc("change_focus", pause)).error).toBeNull();
  expect((await a.client.rpc("change_focus", pause)).error).toBeNull();
  s = await read(s.id);
  expect(s.focused_ms).toBeGreaterThanOrEqual(60000);
  expect(s.focused_ms).toBeLessThan(62000);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision - 1, "resume")))
      .error,
  ).not.toBeNull();
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "resume")))
      .error,
  ).toBeNull();
  s = await read(s.id);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "finish")))
      .error,
  ).toBeNull();
  const fresh = clients.client();
  await fresh.auth.signInWithPassword({ email: a.email, password: a.password });
  expect(
    (await fresh.from("focus_sessions").select("*").eq("id", s.id).single())
      .data?.state,
  ).toBe("completed");
  expect((await snapshot()).active).toBeNull();
  expect((await snapshot()).recent).toHaveLength(1);
  const intervals = (
    await a.client.from("focus_intervals").select("*").eq("session_id", s.id)
  ).data!;
  expect(intervals.length).toBeGreaterThanOrEqual(1);
  s = await read(s.id);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "delete")))
      .error,
  ).toBeNull();
  expect((await snapshot()).recent).toHaveLength(0);
  expect(
    (await a.client.from("focus_intervals").select("*")).data,
  ).toHaveLength(0);
});
it("Pomodoro caps background time, skips breaks and never credits paused/break time", async () => {
  const v = args(undefined, 0, "start", {
    mode: "pomodoro",
    focus_seconds: 60,
    break_seconds: 120,
  });
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 90000);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "pause"))).error,
  ).toBeNull();
  s = await read(s.id);
  expect(s.phase).toBe("break");
  expect(s.state).toBe("paused");
  expect(s.focused_ms).toBe(60000);
  expect(s.remaining_ms).toBeLessThanOrEqual(90000);
  expect(s.remaining_ms).toBeGreaterThan(88000);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "next"))).error,
  ).toBeNull();
  s = await age(s.id, 86400000);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "finish")))
      .error,
  ).toBeNull();
  s = await read(s.id);
  expect(s.focused_ms).toBe(120000);
  expect(
    (await a.client.from("focus_intervals").select("*").eq("session_id", s.id))
      .data,
  ).toHaveLength(2);
});
it("only one active session per owner across semesters/devices; isolation and archive protection", async () => {
  const requests = [args(), { ...args(), p_semester: other }];
  const results = await Promise.all(
    requests.map((v) => a.client.rpc("change_focus", v)),
  );
  expect(results.filter((r) => !r.error)).toHaveLength(1);
  const s = (await a.client.from("focus_sessions").select("*").single()).data!;
  expect((await b.client.from("focus_sessions").select("*")).data).toHaveLength(
    0,
  );
  expect(
    (await b.client.from("focus_intervals").select("*")).data,
  ).toHaveLength(0);
  expect(
    (
      await b.client.rpc("change_focus", {
        ...args(s.id, s.revision, "finish"),
        p_semester: s.semester_id,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await b.client.rpc("focus_snapshot", { p_semester: s.semester_id })).error,
  ).not.toBeNull();
  expect(
    (
      await a.client
        .from("focus_sessions")
        .update({ focused_ms: 9999 })
        .eq("id", s.id)
    ).error,
  ).not.toBeNull();
  expect(
    (await clients.client().rpc("focus_snapshot", {})).error,
  ).not.toBeNull();
  expect(
    (await a.client.from("focus_operations").select("*")).error,
  ).not.toBeNull();
  expect(
    (
      await a.client.rpc("archive_semester", {
        p_id: s.semester_id,
        p_revision: 1,
        p_archive: true,
      })
    ).error?.message,
  ).toContain("active focus");
  expect(
    (
      await a.client.rpc("change_focus", {
        ...args(s.id, s.revision, "finish"),
        p_semester: s.semester_id,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc("archive_semester", {
        p_id: s.semester_id,
        p_revision: 1,
        p_archive: true,
      })
    ).error,
  ).toBeNull();
  const saved = await read(s.id);
  expect(
    (
      await a.client.rpc("change_focus", {
        ...args(s.id, saved.revision, "delete"),
        p_semester: s.semester_id,
      })
    ).error,
  ).not.toBeNull();
  expect((await read(s.id)).state).toBe("completed");
});
it("association snapshots survive course/task deletion without completing a task", async () => {
  const v = args(undefined, 0, "start", { mode: "stopwatch", task_id: task });
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await read(v.p_id);
  expect(s.course_id).toBe(course);
  expect(s.task_label).toBe("Study exam");
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "finish")))
      .error,
  ).toBeNull();
  expect(
    (
      await a.client
        .from("tasks")
        .select("completed_at")
        .eq("id", task)
        .single()
    ).data?.completed_at,
  ).toBeNull();
  expect(
    (
      await a.client.rpc("change_task", {
        p_request: crypto.randomUUID(),
        p_id: task,
        p_semester: term,
        p_revision: 1,
        p_operation: "delete",
        p_payload: {},
      })
    ).error,
  ).toBeNull();
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
  s = await read(s.id);
  expect(s.course_id).toBeNull();
  expect(s.task_id).toBeNull();
  expect(s.course_label).toContain("Math");
  expect(s.task_label).toBe("Study exam");
});
it("Today clips completed intervals at Riyadh midnight, excludes active time, and retains only approved stopwatch time", async () => {
  const v = args();
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 7200000);
  expect((await snapshot()).today_ms).toBe(0);
  expect(
    (
      await a.client.rpc(
        "change_focus",
        args(s.id, s.revision, "finish", { trim_ms: 60000 }),
      )
    ).error,
  ).toBeNull();
  s = await read(s.id);
  expect(s.focused_ms).toBe(60000);
  const midnight = DateTime.now().setZone("Asia/Riyadh").startOf("day");
  const i = (
    await a.client
      .from("focus_intervals")
      .select("*")
      .eq("session_id", s.id)
      .single()
  ).data!;
  expect(
    (
      await clients.admin
        .from("focus_intervals")
        .update({
          started_at: midnight.minus({ minutes: 10 }).toISO()!,
          ended_at: midnight.plus({ minutes: 10 }).toISO()!,
        })
        .eq("id", i.id)
    ).error,
  ).toBeNull();
  expect((await snapshot()).today_ms).toBe(600000);
  expect((await snapshot()).today_sessions).toBe(1);
  const discard = args();
  expect((await a.client.rpc("change_focus", discard)).error).toBeNull();
  expect(
    (await a.client.rpc("change_focus", args(discard.p_id, 1, "discard")))
      .error,
  ).toBeNull();
  expect((await snapshot()).recent).toHaveLength(1);
});
it("invalid configuration and contradictory/foreign associations roll back completely", async () => {
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
  for (const payload of [
    { mode: "invalid" },
    { mode: "pomodoro", focus_seconds: 0 },
    { mode: "pomodoro", break_seconds: 3601 },
    { mode: "stopwatch", task_id: task, course_id: second },
    { mode: "stopwatch", task_id: crypto.randomUUID() },
    { mode: "stopwatch", course_id: crypto.randomUUID() },
  ])
    expect(
      (await a.client.rpc("change_focus", args(undefined, 0, "start", payload)))
        .error,
    ).not.toBeNull();
  expect((await a.client.from("focus_sessions").select("*")).data).toHaveLength(
    0,
  );
  const v = args();
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 10000);
  expect(
    (
      await a.client.rpc(
        "change_focus",
        args(s.id, s.revision, "finish", { trim_ms: 999999 }),
      )
    ).error,
  ).not.toBeNull();
  expect(
    (await a.client.from("focus_intervals").select("*")).data,
  ).toHaveLength(0);
  s = await read(s.id);
  expect(s.state).toBe("running");
  expect(
    (
      await a.client.from("focus_intervals").insert({
        session_id: s.id,
        owner_id: a.id,
        semester_id: term,
        started_at: s.started_at,
        ended_at: new Date().toISOString(),
      })
    ).error,
  ).not.toBeNull();
});
it("expired Pomodoro actions settle once and invalid transitions leave no partial intervals", async () => {
  const v = args(undefined, 0, "start", {
    mode: "pomodoro",
    focus_seconds: 60,
    break_seconds: 60,
  });
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 3600000);
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "pause"))).error,
  ).not.toBeNull();
  expect(
    (await a.client.from("focus_intervals").select("*")).data,
  ).toHaveLength(0);
  const next = args(s.id, s.revision, "next");
  expect((await a.client.rpc("change_focus", next)).error).toBeNull();
  expect((await a.client.rpc("change_focus", next)).error).toBeNull();
  s = await read(s.id);
  expect(s.focused_ms).toBe(60000);
  expect(s.phase).toBe("focus");
  expect(s.state).toBe("running");
  expect(
    (await a.client.from("focus_intervals").select("*")).data,
  ).toHaveLength(1);
});
it("active linked sessions survive deletion and snapshot history stays semester-scoped", async () => {
  const v = args(undefined, 0, "start", { mode: "stopwatch", task_id: task });
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 60000);
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
  const t = (await a.client.from("tasks").select("*").eq("id", task).single())
    .data!;
  expect(
    (
      await a.client.rpc("change_task", {
        p_request: crypto.randomUUID(),
        p_id: task,
        p_semester: term,
        p_revision: t.revision,
        p_operation: "delete",
        p_payload: {},
      })
    ).error,
  ).toBeNull();
  s = await read(s.id);
  expect(s.course_id).toBeNull();
  expect(s.task_id).toBeNull();
  expect(s.course_label).toContain("Math");
  expect(
    (await a.client.rpc("change_focus", args(s.id, s.revision, "finish")))
      .error,
  ).toBeNull();
  const different = (
    await a.client.rpc("focus_snapshot", { p_semester: other })
  ).data as unknown as FocusSnapshot;
  expect(different.recent).toHaveLength(0);
  expect(different.today_ms).toBe(0);
  expect((await snapshot()).recent).toHaveLength(1);
});
it("racing archive and start cannot leave an active session in an archived semester", async () => {
  const [start, archive] = await Promise.all([
    a.client.rpc("change_focus", args()),
    a.client.rpc("archive_semester", {
      p_id: term,
      p_revision: 1,
      p_archive: true,
    }),
  ]);
  expect([start, archive].filter((r) => !r.error)).toHaveLength(1);
  const semester = (
    await a.client.from("semesters").select("*").eq("id", term).single()
  ).data!;
  const active = (await snapshot()).active;
  expect(!!semester.archived_at && !!active).toBe(false);
});
it("changing association does not settle or hide a long unreviewed interval", async () => {
  const v = args();
  expect((await a.client.rpc("change_focus", v)).error).toBeNull();
  let s = await age(v.p_id, 7200000);
  const anchor = s.segment_started_at;
  expect(
    (
      await a.client.rpc(
        "change_focus",
        args(s.id, s.revision, "associate", { task_id: task }),
      )
    ).error,
  ).toBeNull();
  s = await read(s.id);
  expect(s.segment_started_at).toBe(anchor);
  expect(s.focused_ms).toBe(0);
  expect(
    (await a.client.from("focus_intervals").select("*")).data,
  ).toHaveLength(0);
  expect(
    (
      await a.client.rpc(
        "change_focus",
        args(s.id, s.revision, "finish", { trim_ms: 600000 }),
      )
    ).error,
  ).toBeNull();
  expect((await read(s.id)).focused_ms).toBe(600000);
});
