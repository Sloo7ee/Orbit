"use server";
import { createClient } from "@/lib/supabase/server";
import {
  emailSchema,
  passwordSchema,
  type ActionResult,
} from "@/lib/domain/validation";
import { revalidatePath } from "next/cache";
export async function signIn(form: FormData): Promise<ActionResult> {
  const email = emailSchema.safeParse(String(form.get("email") ?? "").trim());
  const password = String(form.get("password") ?? "");
  if (!email.success || !password || password.length > 128)
    return { error: "Enter a valid email address and password." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.data,
      password,
    });
    if (error)
      return {
        error:
          error.status === 429
            ? "Too many attempts. Wait a moment and try again."
            : "Unable to sign in. Check your email and password, then try again.",
      };
  } catch {
    return { error: "Could not reach the sign-in service. Please try again." };
  }
  revalidatePath("/", "layout");
  return { redirectTo: "/" };
}
export async function requestRecovery(form: FormData): Promise<ActionResult> {
  const email = emailSchema.safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { error: "Enter a valid email address." };
  try {
    const supabase = await createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin)
      return {
        error:
          "Password recovery is not configured. Set the application URL first.",
      };
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${origin.replace(/\/$/, "")}/auth/confirm`,
    });
    if (error)
      return {
        error:
          "Could not send a recovery link right now. Wait a moment and try again.",
      };
    return {
      success:
        "If an account exists for this email, you’ll receive a password reset link shortly.",
    };
  } catch {
    return { error: "Could not reach the recovery service. Please try again." };
  }
}
export async function resetPassword(form: FormData): Promise<ActionResult> {
  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: password.error.issues[0].message };
  if (password.data !== form.get("confirm_password"))
    return { error: "The passwords do not match." };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { error: "Your reset session has expired. Request a new link." };
    const { error } = await supabase.auth.updateUser({
      password: password.data,
    });
    if (error)
      return {
        error:
          "Could not update your password. Use a different password or request a new link.",
      };
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError)
      return {
        error:
          "Your password was updated, but sign-out failed. Return to Settings and sign out before signing in again.",
      };
    revalidatePath("/", "layout");
    return { redirectTo: "/sign-in?reset=success" };
  } catch {
    return { error: "Could not save your password. Please try again." };
  }
}
export async function signOut(): Promise<ActionResult> {
  try {
    const { error } = await (
      await createClient()
    ).auth.signOut({ scope: "local" });
    if (error) return { error: "Could not sign out. Please try again." };
    revalidatePath("/", "layout");
    return { redirectTo: "/sign-in" };
  } catch {
    return { error: "Could not sign out. Please try again." };
  }
}
