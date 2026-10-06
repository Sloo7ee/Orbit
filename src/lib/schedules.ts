import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Course } from "./supabase/database.types";
import { DateTime } from "luxon";
import { expandSchedules, upcomingMeetings } from "./domain/recurrence";
export async function recurringRange(
  client: SupabaseClient<Database>,
  semester: string,
  start: string,
  end: string,
  courses: Course[],
) {
  const low = DateTime.fromISO(start).toUTC().minus({ days: 2 }).toISODate()!;
  const high = DateTime.fromISO(end).toUTC().plus({ days: 2 }).toISODate()!;
  const [series, overrides] = await Promise.all([
    client
      .from("course_schedules")
      .select("*", { count: "exact" })
      .eq("semester_id", semester)
      .eq("deleted", false)
      .limit(500),
    client
      .from("schedule_exceptions")
      .select("*", { count: "exact" })
      .eq("semester_id", semester)
      .or(
        `and(original_date.gte.${low},original_date.lte.${high}),and(starts_at.lt.${end},ends_at.gt.${start})`,
      )
      .limit(1000),
  ]);
  if (series.error || overrides.error)
    throw new Error(
      "Could not load class schedules. Check the Phase 4 migration and try again.",
    );
  if (
    (series.count ?? 0) > series.data.length ||
    (overrides.count ?? 0) > overrides.data.length
  )
    throw new Error("Too many schedules or changes. Choose a smaller view.");
  return expandSchedules(series.data, overrides.data, courses, start, end);
}

export async function recurringUpcoming(
  client: SupabaseClient<Database>,
  semester: string,
  courses: Course[],
) {
  const [series, overrides] = await Promise.all([
    client
      .from("course_schedules")
      .select("*", { count: "exact" })
      .eq("semester_id", semester)
      .eq("deleted", false)
      .limit(500),
    client
      .from("schedule_exceptions")
      .select("*", { count: "exact" })
      .eq("semester_id", semester)
      .limit(1000),
  ]);
  if (series.error || overrides.error)
    throw new Error(
      "Could not load class schedules. Check the Phase 4 migration and try again.",
    );
  if (
    (series.count ?? 0) > series.data.length ||
    (overrides.count ?? 0) > overrides.data.length
  )
    throw new Error(
      "This semester has too many schedules or individual changes to load.",
    );
  return upcomingMeetings(
    series.data,
    overrides.data,
    courses,
    new Date().toISOString(),
  );
}
