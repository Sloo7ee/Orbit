import { DateTime } from "luxon";
import { localClients, createTestUser } from "./local-supabase";
export async function designFixture() {
  const clients = localClients(),
    account = await createTestUser(clients),
    semester = crypto.randomUUID(),
    course = crypto.randomUUID();
  const check = (v: { error: unknown }) => {
    if (v.error) throw new Error(JSON.stringify(v.error));
  };
  try {
    check(
      await account.client.rpc("save_profile", {
        p_name: "Saleh Review",
        p_timezone: "Asia/Riyadh",
        p_revision: 0,
      }),
    );
    check(
      await account.client.rpc("create_semester", {
        p_id: semester,
        p_name: "Fall semester",
        p_start: "2026-01-01",
        p_end: "2027-12-31",
      }),
    );
    check(
      await account.client.rpc("save_course", {
        p_id: course,
        p_semester: semester,
        p_revision: 0,
        p_code: "MATH 201",
        p_name: "Linear algebra",
        p_instructor: "Dr. Ahmed",
        p_color: "#a994e8",
      }),
    );
    const today = DateTime.now().setZone("Asia/Riyadh").startOf("day");
    const week = today.minus({ days: today.weekday % 7 });
    for (let i = 0; i < 5; i++) {
      const start = week.plus({ days: i + 1, hours: 9 + (i % 3) });
      check(
        await account.client.rpc("save_event", {
          p_id: crypto.randomUUID(),
          p_semester: semester,
          p_revision: 0,
          p_course: course,
          p_title: [
            "Linear algebra",
            "Problem session",
            "Office hours",
            "Matrix methods",
            "Tutorial",
          ][i],
          p_start: start.toISO()!,
          p_end: start.plus({ minutes: 90 }).toISO()!,
          p_color: ["#ddd2ff", "#c9e2ff", "#c5ecea", "#cdeccf", "#ffd8b5"][i],
        }),
      );
    }
    for (let i = 0; i < 3; i++)
      check(
        await account.client.rpc("change_task", {
          p_id: crypto.randomUUID(),
          p_semester: semester,
          p_revision: 0,
          p_request: crypto.randomUUID(),
          p_operation: "save",
          p_payload: {
            title: [
              "Review chapter 4",
              "Finish problem set",
              "Read lecture notes",
            ][i],
            description: "",
            priority: i === 1 ? "high" : "medium",
            course_id: course,
            due_date: today.plus({ days: 1 }).toISODate(),
            due_time: i === 1 ? "14:00" : "",
          },
        }),
      );
    check(
      await account.client.rpc("change_assessment", {
        p_request: crypto.randomUUID(),
        p_id: crypto.randomUUID(),
        p_semester: semester,
        p_course: course,
        p_revision: 0,
        p_delete: false,
        p_payload: {
          name: "Midterm exam",
          weight: "30",
          score_earned: "",
          score_possible: "100",
          due_date: today.plus({ days: 2 }).toISODate(),
          due_time: "10:00",
          notes: "",
        },
      }),
    );
    check(
      await account.client.rpc("change_assessment", {
        p_request: crypto.randomUUID(),
        p_id: crypto.randomUUID(),
        p_semester: semester,
        p_course: course,
        p_revision: 0,
        p_delete: false,
        p_payload: {
          name: "First quiz",
          weight: "10",
          score_earned: "18",
          score_possible: "20",
          due_date: "",
          due_time: "",
          notes: "",
        },
      }),
    );
    check(
      await account.client.rpc("change_note", {
        p_request: crypto.randomUUID(),
        p_id: crypto.randomUUID(),
        p_semester: semester,
        p_course: course,
        p_revision: 0,
        p_delete: false,
        p_title: "Vector spaces",
        p_content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Linear combinations" }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "A vector space is closed under addition and scalar multiplication. Start by checking the two operations, then work through the examples.",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "Review the basis and dimension of each space.",
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "Compare independent and spanning sets.",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );
    // Real completed records for deterministic chart inspection; local test administrator only.
    const start = DateTime.now().minus({ minutes: 45 }),
      end = start.plus({ minutes: 30 }),
      session = crypto.randomUUID();
    check(
      await clients.admin
        .from("focus_sessions")
        .insert({
          id: session,
          owner_id: account.id,
          semester_id: semester,
          course_id: course,
          course_label: "MATH 201 · Linear algebra",
          mode: "stopwatch",
          state: "completed",
          phase: "focus",
          focus_seconds: 1500,
          break_seconds: 300,
          focused_ms: 1800000,
          started_at: start.toISO()!,
          ended_at: end.toISO()!,
        }),
    );
    check(
      await clients.admin
        .from("focus_intervals")
        .insert({
          session_id: session,
          owner_id: account.id,
          semester_id: semester,
          started_at: start.toISO()!,
          ended_at: end.toISO()!,
        }),
    );
    return { clients, account, semester, course };
  } catch (e) {
    await clients.admin.auth.admin.deleteUser(account.id);
    throw e;
  }
}
