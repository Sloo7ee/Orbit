import { DraftProvider } from "@/components/notes/draft-provider";
import { loadFocus } from "@/lib/focus";
import { FocusProvider } from "@/components/focus/focus-provider";
import { loadWorkspace } from "@/lib/data";
import { AppShell } from "@/components/shell/app-shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, semesters, selected } = await loadWorkspace();
  const focus = await loadFocus();
  return (
    <DraftProvider>
      <FocusProvider key={selected?.id ?? "none"} initial={focus}>
        <AppShell profile={profile} semesters={semesters} selected={selected}>
          {children}
        </AppShell>
      </FocusProvider>
    </DraftProvider>
  );
}
