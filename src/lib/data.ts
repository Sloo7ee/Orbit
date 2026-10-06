import { recurringUpcoming } from "./schedules";
import type { CalendarItem } from "./domain/recurrence";
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { supabaseConfig } from "./supabase/config";
export const requireUser = cache(async () => {
  if (!supabaseConfig()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new Error("Sign-in service is temporarily unavailable.");
  if (!user) redirect("/sign-in");
  return { supabase, user };
});
export const loadWorkspace = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Could not load your profile. Check the database setup and try again.",
    );
  if (!profile) redirect("/onboarding");
  const { data: semesters, error: semesterError } = await supabase
    .from("semesters")
    .select("*")
    .order("start_date", { ascending: false });
  if (semesterError) throw new Error("Could not load your semesters.");
  return {
    profile,
    semesters,
    email: user.email ?? "",
    selected:
      semesters.find((s) => s.id === profile.selected_semester_id) ?? null,
  };
});
export const loadAcademic = cache(async () => {
  const workspace = await loadWorkspace();
  const { supabase } = await requireUser();
  if (!workspace.selected) return { ...workspace, courses: [], upcoming: [] };
  const [courses, upcoming] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("semester_id", workspace.selected.id)
      .order("code"),
    supabase
      .from("calendar_events")
      .select("*")
      .eq("semester_id", workspace.selected.id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(3),
  ]);
  if (courses.error || upcoming.error)
    throw new Error(
      "Could not load courses and events. Check the Phase 3 database migration and try again.",
    );
  const recurring = await recurringUpcoming(
    supabase,
    workspace.selected.id,
    courses.data,
  );
  const next: CalendarItem[] = [...upcoming.data, ...recurring];
  return {
    ...workspace,
    courses: courses.data,
    upcoming: next
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
      .slice(0, 3),
  };
});
