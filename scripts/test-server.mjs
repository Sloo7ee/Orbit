import { execFileSync, spawn } from "node:child_process";
const config = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (new URL(config.API_URL).hostname !== "127.0.0.1")
  throw new Error("Local backend required");
const env = {
  ...process.env,
  ORBIT_TEST_SERVER: "1",
  NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3001",
};
const production = process.env.ORBIT_TEST_DEV !== "1";
if (production)
  execFileSync("npx", ["next", "build"], { stdio: "inherit", env });
const child = spawn(
  "npx",
  [
    "next",
    production ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  { stdio: "inherit", env },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
