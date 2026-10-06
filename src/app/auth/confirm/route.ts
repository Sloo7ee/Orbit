import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  // Use the configured public origin. Next's internal request host can differ
  // (localhost vs 127.0.0.1), which would lose the newly issued host-only cookie.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const go = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  if (!supabaseConfig()) return go("/setup");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const client = await createClient();
  if (token_hash && type === "recovery") {
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: "recovery",
    });
    if (!error) return go("/reset-password");
  } else if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return go("/reset-password");
  }
  return go("/sign-in?error=invalid-link");
}
