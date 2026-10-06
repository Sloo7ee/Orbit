// UI conversions only. The database and actions still receive HH:mm wall time.
export function parsePickerTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]),
    period = match[3]?.toUpperCase();
  if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (period) hour = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
export function displayPickerTime(value: string): string {
  if (!value) return "";
  const hour = Number(value.slice(0, 2));
  return `${hour % 12 || 12}:${value.slice(3, 5)} ${hour < 12 ? "AM" : "PM"}`;
}
