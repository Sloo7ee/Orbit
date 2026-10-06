import Link from "next/link";
import { AuthFrame } from "@/components/forms/auth-frame";
import { ActionForm } from "@/components/forms/action-form";
import { resetPassword } from "@/lib/actions/auth";
import { requireUser } from "@/lib/data";
export const metadata = { title: "New password" };
export default async function ResetPassword() {
  await requireUser();
  return (
    <AuthFrame
      title="Choose a new password."
      description="Use at least 12 characters to protect your workspace."
    >
      <ActionForm
        action={resetPassword}
        submitLabel="Save new password"
        pendingLabel="Updating…"
      >
        <label>
          New password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
      </ActionForm>
      <Link href="/forgot-password" className="auth-link">
        Request another reset link
      </Link>
    </AuthFrame>
  );
}
