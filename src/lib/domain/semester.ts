export function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function isDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "9999-12-31"
  )
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function semesterProgress(
  start: string,
  end: string,
  timezone: string,
  now = new Date(),
) {
  const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
  const today = day(localDate(now, timezone));
  const first = day(start);
  const last = day(end);
  const total = last - first + 1;
  if (!isDate(start) || !isDate(end) || total < 1)
    throw new Error("Invalid semester dates");
  const elapsed = Math.max(0, Math.min(total, today - first));
  return {
    percent: Math.floor((elapsed / total) * 100),
    daysRemaining: Math.max(0, Math.min(total, last - today + 1)),
    status:
      today < first
        ? ("upcoming" as const)
        : today > last
          ? ("ended" as const)
          : ("active" as const),
  };
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function greeting(name: string, timezone: string, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${name.trim().split(/\s+/)[0]}.`;
}
