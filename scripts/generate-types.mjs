import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const types = execFileSync(
  "npx",
  ["supabase", "gen", "types", "typescript", "--local"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
if (!types.includes("export type Database"))
  throw new Error(
    "Type generation returned no schema. Existing types preserved.",
  );
// Postgres RPC argument metadata omits nullability; p_course explicitly accepts null.
writeFileSync(
  "src/lib/supabase/database.types.ts",
  types.replace(/("?p_course"?: string)/g, "$1 | null").replace(/("?p_original"?: string)/g, "$1 | null") +
    '\nexport type CourseSchedule = Database["public"]["Tables"]["course_schedules"]["Row"];\nexport type ScheduleException = Database["public"]["Tables"]["schedule_exceptions"]["Row"];\nexport type Course = Database["public"]["Tables"]["courses"]["Row"];\nexport type CalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];\n' +
    '\nexport type Profile = Database["public"]["Tables"]["profiles"]["Row"];\nexport type Semester = Database["public"]["Tables"]["semesters"]["Row"];\n',
);
