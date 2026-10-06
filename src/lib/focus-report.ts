import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { focusWeek, weeklyFocus } from "./domain/home";
export async function readWeeklyFocus(
  supabase: SupabaseClient<Database>,
  semesterId: string,
  zone: string,
  now = new Date(),
) {
  const week = focusWeek(zone, now);
  const intervals: { started_at: string; ended_at: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("focus_intervals")
      .select("started_at,ended_at,focus_sessions!inner(state)")
      .eq("semester_id", semesterId)
      .eq("focus_sessions.state", "completed")
      .gt("ended_at", week.start)
      .lt("started_at", week.end)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Could not load weekly focus. Please retry.");
    intervals.push(...data);
    if (data.length < 500) break;
  }
  return weeklyFocus(intervals, zone, now);
}
