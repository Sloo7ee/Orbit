import { DateTime } from "luxon";
import { z } from "zod";
import { coursePalette } from "./course-colors";
export const colors = coursePalette.map((c) => c.day);
export const courseSchema = z.object({
  id: z.uuid(),
  semester_id: z.uuid(),
  revision: z.coerce.number().int().min(0),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  instructor: z.string().trim().max(120),
  color: z.string().regex(/^#[\da-f]{6}$/i),
});
export const eventSchema = z
  .object({
    id: z.uuid(),
    semester_id: z.uuid(),
    revision: z.coerce.number().int().min(0),
    title: z.string().trim().min(1).max(160),
    course_id: z.union([z.uuid(), z.literal("")]),
    color: z.string().regex(/^#[\da-f]{6}$/i),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
  })
  .refine((v) => Date.parse(v.ends_at) > Date.parse(v.starts_at), {
    message: "End must be after start.",
  });
// Reject missing wall-clock times rather than silently shifting a DST gap.
// Repeated times consistently select the earlier instant.
export function wallTime(value: string, zone: string): string {
  const date = DateTime.fromISO(value, { zone });
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== value)
    throw new Error("This local time does not exist. Choose another time.");
  return date
    .getPossibleOffsets()
    .sort((a, b) => a.toMillis() - b.toMillis())[0]
    .toUTC()
    .toISO()!;
}
export function localInput(iso: string, zone: string) {
  return DateTime.fromISO(iso, { zone }).toFormat("yyyy-MM-dd'T'HH:mm");
}

export function eventTextColor(hex: string): string {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
