import { NotesPage } from "@/components/notes/notes-page";
import { FocusPage } from "@/components/focus/focus-page";
import { GradePage } from "@/components/grades/grade-page";
import { TaskPage } from "@/components/tasks/task-page";
import { CoursePage } from "@/components/courses/course-page";
import { notFound } from "next/navigation";
import { navigation } from "@/components/shell/navigation";
import { SectionPreview } from "@/components/preview/section-preview";
import { HomePreview } from "@/components/preview/home-preview";
import { SemesterPage } from "@/components/semesters/semester-page";
import { SettingsPage } from "@/components/forms/settings-page";
import { loadWorkspace } from "@/lib/data";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return {
    title:
      navigation.find((item) => item.href === `/${section}`)?.label ??
      "Page not found",
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ created?: string; course?: string }>;
}) {
  await loadWorkspace();
  const { section } = await params;
  if (!navigation.some((item) => item.href === `/${section}`)) notFound();
  if (section === "grades")
    return <GradePage courseId={(await searchParams).course} />;
  if (section === "notes") return <NotesPage />;
  if (section === "focus") return <FocusPage />;
  if (section === "todo") return <TaskPage />;
  if (section === "courses") return <CoursePage />;
  if (section === "calendar") return <HomePreview calendarOnly />;
  if (section === "semesters") return <SemesterPage />;
  if (section === "settings") return <SettingsPage />;
  return <SectionPreview section={section} />;
}
