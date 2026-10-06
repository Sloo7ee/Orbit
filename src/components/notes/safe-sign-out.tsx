"use client";
import { ActionForm } from "@/components/forms/action-form";
import { signOut } from "@/lib/actions/auth";
import { useNoteDraft } from "./draft-provider";
export function SafeSignOut() {
  const { store } = useNoteDraft();
  return (
    <ActionForm
      action={async () => {
        if (!(await store.flush()))
          return {
            error:
              "Your note is not saved. Return to Notes to retry or resolve the draft before signing out.",
          };
        return signOut();
      }}
      submitLabel="Sign out"
      pendingLabel="Signing out…"
    />
  );
}
