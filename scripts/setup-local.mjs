import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (!["127.0.0.1", "localhost"].includes(new URL(config.API_URL).hostname))
  throw new Error("Local setup requires a local Supabase stack.");
if (
  existsSync(".env.local") &&
  !readFileSync(".env.local", "utf8").includes(
    `NEXT_PUBLIC_SUPABASE_URL=${config.API_URL}`,
  )
)
  throw new Error(
    "An existing environment is configured. Preserve it before choosing local setup.",
  );
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${config.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${config.PUBLISHABLE_KEY ?? config.ANON_KEY}\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000\n`,
  { mode: 0o600 },
);
mkdirSync(".orbit", { recursive: true });
if (!existsSync(".orbit/local-account.txt")) {
  const password = randomBytes(18).toString("base64url");
  const admin = createClient(
    config.API_URL,
    config.SERVICE_ROLE_KEY ?? config.SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.auth.admin.createUser({
    email: "saleh@orbit.local",
    password,
    email_confirm: true,
  });
  if (error)
    throw new Error(
      "Could not create local preview account. Use the local Studio to manage existing accounts.",
    );
  writeFileSync(
    ".orbit/local-account.txt",
    `Orbit LOCAL preview only\nEmail: saleh@orbit.local\nPassword: ${password}\n\nThis account exists only in Docker on this Mac. Create a separate account in cloud Supabase.\n`,
    { mode: 0o600 },
  );
}
console.log(
  "Local environment ready. Local preview credentials are in .orbit/local-account.txt. No cloud project has been connected.",
);
