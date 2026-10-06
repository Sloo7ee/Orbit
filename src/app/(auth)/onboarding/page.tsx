import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { AuthFrame } from "@/components/forms/auth-frame";
import { ProfileForm } from "@/components/forms/profile-form";
import { ActionForm } from "@/components/forms/action-form";
import { signOut } from "@/lib/actions/auth";
export const metadata = { title: "Set up your profile" };
export default async function Onboarding() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Could not load profile setup.");
  if (data) redirect("/");
  return (
    <AuthFrame
      title="Make Orbit yours."
      description="Just your name and timezone. You can change these later."
    >
      <ProfileForm />
      <ActionForm
        action={signOut}
        submitLabel="Sign out"
        className="quiet-form"
      />
    </AuthFrame>
  );
}
