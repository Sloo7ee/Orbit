import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/forms/auth-frame";
import { ActionForm } from "@/components/forms/action-form";
import { signIn } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Sign in" };
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  if (!supabaseConfig()) redirect("/setup");
  const query = await searchParams;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user && !query.error) redirect("/");
  return (
    <AuthFrame
      title="Welcome back."
      description="Sign in to your Orbit workspace."
    >
      {query.reset === "success" && (
        <p className="form-message form-success" role="status">
          Password updated. Sign in with your new password.
        </p>
      )}
      {query.error && (
        <p className="form-message form-error" role="alert">
          This link is invalid or has expired. Request a new password reset
          link.
        </p>
      )}
      <ActionForm
        action={signIn}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
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
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
      </ActionForm>
      <Link href="/forgot-password" className="auth-link">
        Forgot password?
      </Link>
    </AuthFrame>
  );
}
