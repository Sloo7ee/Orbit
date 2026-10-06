import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
import { AuthFrame } from "@/components/forms/auth-frame";
export const metadata = { title: "Connect Orbit" };
export default function Setup() {
  if (supabaseConfig()) redirect("/sign-in");
  return (
    <AuthFrame
      title="Connect your workspace."
      description="Orbit needs a Supabase connection before you can sign in."
    >
      <div className="setup-instructions">
        <p>
          Follow <strong>SUPABASE_SETUP.md</strong> in the project folder to
          create your project, apply the migration, and add your account.
        </p>
        <p>
          Add the project URL and publishable key to <code>.env.local</code>,
          then restart Orbit.
        </p>
        <span className="badge">No connection configured</span>
      </div>
    </AuthFrame>
  );
}
