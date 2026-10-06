import { z } from "zod";
import { isDate } from "./semester";
export const emailSchema = z.email("Enter a valid email address.").max(254);
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use no more than 128 characters.");
export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Use no more than 80 characters."),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return value === "UTC" || value.includes("/");
      } catch {
        return false;
      }
    }, "Choose a valid timezone."),
});
export const semesterSchema = z
  .object({
    id: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1, "Enter a semester name.")
      .max(100, "Use no more than 100 characters."),
    start_date: z.string().refine(isDate, "Enter a valid start date."),
    end_date: z.string().refine(isDate, "Enter a valid end date."),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "End date must be on or after the start date.",
    path: ["end_date"],
  });
export type ActionResult = {
  error?: string;
  success?: string;
  redirectTo?: string;
  revision?: number;
};
