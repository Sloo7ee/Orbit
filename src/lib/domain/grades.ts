import { z } from "zod";
import { DateTime } from "luxon";
import { wallTime } from "./calendar";
import type { Database } from "../supabase/database.types";
export type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
const decimal = z
  .string()
  .regex(
    /^\d+(\.\d{1,4})?$/,
    "Use a positive decimal with up to four decimal places.",
  );
export function scaled(value: string | number): bigint {
  const [whole, part = ""] = String(value).split(".");
  return BigInt(whole) * 10000n + BigInt(part.padEnd(4, "0"));
}
export const assessmentFields = z
  .object({
    name: z.string().trim().min(1).max(160),
    weight: decimal,
    score_earned: z.union([decimal, z.literal("")]),
    score_possible: decimal,
    due_date: z
      .string()
      .refine(
        (v) =>
          !v ||
          (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
            v >= "1900-01-01" &&
            DateTime.fromISO(v).isValid),
      ),
    due_time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
    notes: z.string().max(4000),
  })
  .superRefine((v, c) => {
    const valid = [
      v.weight,
      v.score_possible,
      ...(v.score_earned ? [v.score_earned] : []),
    ].every((x) => /^\d+(\.\d{1,4})?$/.test(x));
    if (!valid) return;
    if (scaled(v.weight) <= 0n || scaled(v.weight) > 1000000n)
      c.addIssue({
        code: "custom",
        message: "Weight must be greater than 0 and no more than 100.",
        path: ["weight"],
      });
    if (
      scaled(v.score_possible) <= 0n ||
      scaled(v.score_possible) > 10000000000000n
    )
      c.addIssue({
        code: "custom",
        message:
          "Possible score must be greater than 0 and no more than 1,000,000,000.",
        path: ["score_possible"],
      });
    if (
      v.score_earned !== "" &&
      scaled(v.score_earned) > scaled(v.score_possible)
    )
      c.addIssue({
        code: "custom",
        message: "Earned score cannot exceed the possible score.",
        path: ["score_earned"],
      });
    if (v.due_time && !v.due_date)
      c.addIssue({
        code: "custom",
        message: "Choose a date before a due time.",
        path: ["due_time"],
      });
  });
type Fraction = { n: bigint; d: bigint };
function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
function add(a: Fraction, b: Fraction): Fraction {
  const n = a.n * b.d + b.n * a.d,
    d = a.d * b.d,
    g = gcd(n, d);
  return { n: n / g, d: d / g };
}
// Round only at the display boundary (half up), never during accumulation.
export function displayFraction(n: bigint, d: bigint) {
  const cents = (n * 200n + d) / (2n * d);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
export function assessmentResult(
  a: Pick<Assessment, "weight" | "score_earned" | "score_possible">,
) {
  if (a.score_earned === null) return { percentage: null, contribution: null };
  const e = scaled(a.score_earned),
    p = scaled(a.score_possible),
    w = scaled(a.weight);
  return {
    percentage: displayFraction(e * 100n, p),
    contribution: displayFraction(e * w, p * 10000n),
  };
}
export function summarizeGrades(
  items: Pick<Assessment, "weight" | "score_earned" | "score_possible">[],
) {
  let configured = 0n,
    coverage = 0n,
    earned: Fraction = { n: 0n, d: 1n };
  for (const a of items) {
    const w = scaled(a.weight);
    configured += w;
    if (a.score_earned !== null) {
      coverage += w;
      earned = add(earned, {
        n: scaled(a.score_earned) * w,
        d: scaled(a.score_possible) * 10000n,
      });
    }
  }
  return {
    current: coverage
      ? displayFraction(earned.n * 1000000n, earned.d * coverage)
      : null,
    coverage: displayFraction(coverage, 10000n),
    earned: displayFraction(earned.n, earned.d),
    configured: displayFraction(configured, 10000n),
    remaining: displayFraction(1000000n - configured, 10000n),
    weightWarning:
      configured === 1000000n
        ? "All 100% of course weight is configured."
        : configured >= 900000n
          ? "Course weight is approaching 100%."
          : null,
  };
}
export function assessmentCalendarDate(
  a: Pick<Assessment, "due_date" | "due_time">,
  zone: string,
) {
  if (!a.due_date) return null;
  if (!a.due_time) return a.due_date;
  try {
    return wallTime(`${a.due_date}T${a.due_time.slice(0, 5)}`, zone);
  } catch {
    return DateTime.fromISO(`${a.due_date}T${a.due_time}`, { zone }).toISO();
  }
}
