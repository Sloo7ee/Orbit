import { expect, it } from "vitest";
import { parsePickerTime, displayPickerTime } from "@/lib/domain/picker-time";
it("keeps exact minutes and converts midnight/noon only at the UI boundary", () => {
  for (const [text, value] of [
    ["12:00 AM", "00:00"],
    ["12:00 PM", "12:00"],
    ["10:03 AM", "10:03"],
    ["1:47 pm", "13:47"],
    ["23:59", "23:59"],
    ["00:00", "00:00"],
  ])
    expect(parsePickerTime(text)).toBe(value);
  for (const time of ["00:00", "12:00", "10:03", "13:47", "23:59"])
    expect(parsePickerTime(displayPickerTime(time))).toBe(time);
  for (const invalid of [
    "24:00",
    "13:00 AM",
    "0:30 PM",
    "12:60",
    "1:3",
    "oops",
  ])
    expect(parsePickerTime(invalid)).toBeNull();
});
