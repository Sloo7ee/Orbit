import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/forms/auth-frame";
import { ActionForm } from "@/components/forms/action-form";
import { requestRecovery } from "@/lib/actions/auth";
import { supabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Reset password" };
export default function ForgotPassword() {
  if (!supabaseConfig()) redirect("/setup");
  return (
    <AuthFrame
      title="Reset your password."
      description="We’ll email you a link to choose a new password."
    >
      <ActionForm
        persistentSuccess
        action={requestRecovery}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
      >
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </label>
      </ActionForm>
      <Link href="/sign-in" className="auth-link">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
