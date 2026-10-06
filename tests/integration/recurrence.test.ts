import { beforeEach, afterEach, it, expect } from "vitest";
import { localClients, createTestUser } from "../helpers/local-supabase";
import { expandSchedules } from "../../src/lib/domain/recurrence";
import type { Json } from "../../src/lib/supabase/database.types";
const clients = localClients();
let a: Awaited<ReturnType<typeof createTestUser>>, b: typeof a;
let semester: string, course: string, schedule: string;
const fields = {
  weekdays: [0, 2, 4],
  start_time: "09:00",
  end_time: "10:00",
  location: "Room 1",
  effective_start: "2026-09-01",
  effective_end: "2026-12-31",
};
beforeEach(async () => {
  a = await createTestUser(clients);
  b = await createTestUser(clients);
  semester = crypto.randomUUID();
  course = crypto.randomUUID();
  schedule = crypto.randomUUID();
  for (const u of [a, b])
    await u.client.rpc("save_profile", {
      p_name: "Recurring test",
      p_timezone: "Asia/Riyadh",
      p_revision: 0,
    });
  await a.client.rpc("create_semester", {
    p_id: semester,
    p_name: "Term",
    p_start: "2026-09-01",
    p_end: "2026-12-31",
  });
  await a.client.rpc("save_course", {
    p_id: course,
    p_semester: semester,
    p_revision: 0,
    p_code: "M101",
    p_name: "Calculus",
    p_instructor: "",
    p_color: "#79c5ab",
  });
  expect(
    (
      await a.client.rpc("change_schedule", {
        p_request: crypto.randomUUID(),
        p_id: schedule,
        p_revision: 0,
        p_scope: "create",
        p_original: null,
        p_delete: false,
        p_payload: { ...fields, course_id: course },
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
async function change(
  scope: string,
  original: string | null,
  payload: Json = {},
  del = false,
  id = schedule,
) {
  const row = (
    await a.client.from("course_schedules").select("*").eq("id", id).single()
  ).data!;
  return a.client.rpc("change_schedule", {
    p_request: crypto.randomUUID(),
    p_id: id,
    p_revision: row.revision,
    p_scope: scope,
    p_original: original,
    p_delete: del,
    p_payload: payload,
  });
}
async function read(
  start = "2026-09-01T00:00:00Z",
  end = "2026-11-01T00:00:00Z",
) {
  const series = (await a.client.from("course_schedules").select("*")).data!;
  const exceptions = (await a.client.from("schedule_exceptions").select("*"))
    .data!;
  const courses = (await a.client.from("courses").select("*")).data!;
  return {
    series,
    exceptions,
    events: expandSchedules(series, exceptions, courses, start, end).events,
  };
}
it("stores blocks once, expands weekly meetings and persists across authenticated sessions", async () => {
  expect(
    (
      await a.client.rpc("change_schedule", {
        p_request: crypto.randomUUID(),
        p_id: crypto.randomUUID(),
        p_revision: 0,
        p_scope: "create",
        p_original: null,
        p_delete: false,
        p_payload: {
          ...fields,
          course_id: course,
          start_time: "14:00",
          end_time: "15:00",
        },
      })
    ).error,
  ).toBeNull();
  const fresh = clients.client();
  await fresh.auth.signInWithPassword({ email: a.email, password: a.password });
  expect((await fresh.from("course_schedules").select("*")).data).toHaveLength(
    2,
  );
  expect((await fresh.from("calendar_events").select("*")).data).toHaveLength(
    0,
  );
  expect((await read()).events).toHaveLength(52);
});
it("moves and cancels one occurrence without mutating the weekly pattern", async () => {
  expect(
    (
      await change("one", "2026-09-01", {
        starts_at: "2026-10-14T08:00:00Z",
        ends_at: "2026-10-14T09:00:00Z",
        location: "Lab",
      })
    ).error,
  ).toBeNull();
  expect((await change("one", "2026-09-03", {}, true)).error).toBeNull();
  const data = await read();
  expect(data.series[0].start_time).toBe("09:00:00");
  expect(data.exceptions).toHaveLength(2);
  expect(data.events.find((e) => e.id.endsWith("2026-09-01"))?.starts_at).toBe(
    "2026-10-14T08:00:00+00:00",
  );
  expect(data.events.some((e) => e.id.endsWith("2026-09-03"))).toBe(false);
});
it("splits future meetings atomically, keeps past exceptions, resets confirmed future overrides and replays safely", async () => {
  await change("one", "2026-09-01", {
    starts_at: "2026-10-14T08:00:00Z",
    ends_at: "2026-10-14T09:00:00Z",
    location: "Past original moved forward",
  });
  await change("one", "2026-10-04", {}, true);
  const args = {
    p_request: crypto.randomUUID(),
    p_id: schedule,
    p_revision: 3,
    p_scope: "future",
    p_original: "2026-10-01",
    p_delete: false,
    p_payload: {
      ...fields,
      effective_start: "2026-10-01",
      start_time: "11:00",
      end_time: "12:00",
      confirm_reset: true,
    },
  };
  const split = await a.client.rpc("change_schedule", args);
  expect(split.error).toBeNull();
  expect((await a.client.rpc("change_schedule", args)).data).toBe(split.data);
  const data = await read();
  expect(data.series).toHaveLength(2);
  expect(data.exceptions.map((e) => e.original_date)).toEqual(["2026-09-01"]);
  expect(
    data.events.find((e) => e.id.endsWith("2026-09-29"))?.starts_at,
  ).toContain("06:00:00");
  expect(
    data.events.find((e) => e.id.endsWith("2026-10-01"))?.starts_at,
  ).toContain("08:00:00");
  expect(data.events.filter((e) => e.id.endsWith("2026-09-01"))).toHaveLength(
    1,
  );
});
it("future delete preserves previous meetings; entire edit/delete respects explicit scope", async () => {
  await change("one", "2026-09-01", {}, true);
  expect(
    (
      await change("all", null, {
        ...fields,
        start_time: "12:00",
        end_time: "13:00",
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await change("all", null, {
        ...fields,
        start_time: "12:00",
        end_time: "13:00",
        confirm_reset: true,
      })
    ).error,
  ).toBeNull();
  expect((await read()).exceptions).toHaveLength(0);
  expect(
    (await change("future", "2026-10-01", { confirm_reset: true }, true)).error,
  ).toBeNull();
  let data = await read();
  expect(
    data.events.every((e) => e.recurring!.original_date < "2026-10-01"),
  ).toBe(true);
  expect(data.events[0].starts_at).toContain("09:00:00");
  expect(
    (await change("all", null, { confirm_reset: true }, true)).error,
  ).toBeNull();
  data = await read();
  expect(data.events).toHaveLength(0);
});
it("rejects stale/conflicting writes and forged ownership, parent links, anonymous requests and raw writes", async () => {
  expect((await b.client.from("course_schedules").select("*")).data).toEqual(
    [],
  );
  expect((await b.client.from("schedule_exceptions").select("*")).data).toEqual(
    [],
  );
  const args = {
    p_request: crypto.randomUUID(),
    p_id: schedule,
    p_revision: 1,
    p_scope: "one",
    p_original: "2026-09-01",
    p_delete: true,
    p_payload: {},
  };
  expect((await b.client.rpc("change_schedule", args)).error).not.toBeNull();
  expect(
    (await clients.client().rpc("change_schedule", args)).error,
  ).not.toBeNull();
  expect(
    (
      await b.client.rpc("change_schedule", {
        ...args,
        p_id: crypto.randomUUID(),
        p_revision: 0,
        p_scope: "create",
        p_delete: false,
        p_payload: { ...fields, course_id: course },
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await a.client
        .from("course_schedules")
        .update({ location: "Bypass" })
        .eq("id", schedule)
    ).error,
  ).not.toBeNull();
  const results = await Promise.all([
    a.client.rpc("change_schedule", args),
    a.client.rpc("change_schedule", {
      ...args,
      p_request: crypto.randomUUID(),
      p_original: "2026-09-03",
    }),
  ]);
  expect(results.filter((r) => r.error === null)).toHaveLength(1);
  expect(
    (await a.client.from("schedule_exceptions").select("*")).data,
  ).toHaveLength(1);
});
it("enforces semester boundaries and archive protection, preserves schedules when deleting a course", async () => {
  expect(
    (
      await change("all", null, {
        ...fields,
        effective_end: "2027-01-01",
        confirm_reset: true,
      })
    ).error,
  ).not.toBeNull();
  expect((await change("one", "2026-09-02", {}, true)).error).not.toBeNull();
  await a.client.rpc("archive_semester", {
    p_id: semester,
    p_revision: 1,
    p_archive: true,
  });
  expect((await change("one", "2026-09-01", {}, true)).error).not.toBeNull();
  expect((await read()).events.length).toBeGreaterThan(0);
  await a.client.rpc("archive_semester", {
    p_id: semester,
    p_revision: 2,
    p_archive: false,
  });
  expect(
    (
      await a.client.rpc("delete_academic", {
        p_kind: "course",
        p_id: course,
        p_semester: semester,
        p_revision: 1,
      })
    ).error,
  ).toBeNull();
  const data = await read();
  expect(data.series[0].course_id).toBeNull();
  expect(data.events[0].color).toBe("#79c5ab");
  expect(data.events[0].title).toBe("Calculus");
});
