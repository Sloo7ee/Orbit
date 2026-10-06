import { DateTime } from "luxon";
import { it, expect } from "vitest";
import { designFixture } from "../helpers/design-fixture";
import { createTestUser } from "../helpers/local-supabase";
import { readWeeklyFocus } from "../../src/lib/focus-report";
it("weekly report reads completed intervals, excludes active sessions, and isolates semesters and owners", async () => {
  const f = await designFixture(),
    other = await createTestUser(f.clients);
  try {
    const total = async (client = f.account.client, term = f.semester) =>
      (await readWeeklyFocus(client, term, "Asia/Riyadh")).reduce(
        (s, d) => s + d.milliseconds,
        0,
      );
    // The fixture may cross a Sunday boundary, so calculate its current-week overlap.
    const interval = (
      await f.account.client
        .from("focus_intervals")
        .select("started_at,ended_at")
        .single()
    ).data!;
    const today = DateTime.now().setZone("Asia/Riyadh").startOf("day");
    const weekStart = today.minus({ days: today.weekday % 7 }).toMillis();
    const expected = Math.max(
      0,
      Date.parse(interval.ended_at) -
        Math.max(Date.parse(interval.started_at), weekStart),
    );
    expect(await total()).toBe(expected);
    const before = await total(),
      active = crypto.randomUUID();
    expect(
      (
        await f.account.client.rpc("change_focus", {
          p_request: crypto.randomUUID(),
          p_id: active,
          p_semester: f.semester,
          p_revision: 0,
          p_operation: "start",
          p_payload: {
            mode: "stopwatch",
            focus_seconds: 1500,
            break_seconds: 300,
            course_id: null,
            task_id: null,
          },
        })
      ).error,
    ).toBeNull();
    const end = new Date(),
      start = new Date(end.getTime() - 60000);
    expect(
      (
        await f.clients.admin.from("focus_intervals").insert({
          session_id: active,
          owner_id: f.account.id,
          semester_id: f.semester,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
        })
      ).error,
    ).toBeNull();
    expect(await total()).toBe(before);
    expect(await total(other.client)).toBe(0);
    expect(await total(f.account.client, crypto.randomUUID())).toBe(0);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
    await f.clients.admin.auth.admin.deleteUser(other.id);
  }
});
