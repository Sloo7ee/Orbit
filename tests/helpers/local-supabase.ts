import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
// These tests intentionally target only the local CLI stack. Never cloud data.
export function localClients() {
  const config = JSON.parse(
    execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const url = config.API_URL;
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("Tests require a local Supabase instance.");
  const key = config.ANON_KEY ?? config.PUBLISHABLE_KEY;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    url,
    admin: createClient<Database>(
      url,
      config.SERVICE_ROLE_KEY ?? config.SECRET_KEY,
      options,
    ),
    client: () => createClient<Database>(url, key, options),
  };
}
export async function createTestUser(clients: ReturnType<typeof localClients>) {
  const email = `orbit-${randomUUID()}@example.test`;
  const password = `Orbit-test-${randomUUID()}!`;
  const { data, error } = await clients.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw new Error("Could not create local test account.");
  const client = clients.client();
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) {
    await clients.admin.auth.admin.deleteUser(data.user.id);
    throw signed.error;
  }
  return { id: data.user.id, email, password, client };
}
