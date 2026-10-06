import type { CSSProperties } from "react";
// Canonical Day hex values retain compatibility with the existing persisted hex schema.
// Rendering resolves an identity; legacy records are never rewritten implicitly.
export const coursePalette = [
  { id: "lavender", name: "Lavender", day: "#ddd2ff", night: "#514963" },
  { id: "sky", name: "Sky", day: "#c9e2ff", night: "#40576b" },
  { id: "aqua", name: "Aqua", day: "#c5ecea", night: "#405f5e" },
  { id: "mint", name: "Mint", day: "#cdeccf", night: "#4a604f" },
  { id: "butter", name: "Butter", day: "#f7e7a9", night: "#655c40" },
  { id: "peach", name: "Peach", day: "#ffd8b5", night: "#6b5647" },
  { id: "rose", name: "Rose", day: "#f6c9d8", night: "#6a4f5c" },
  { id: "coral", name: "Coral", day: "#f5c2bc", night: "#6b504c" },
] as const;
const legacy: Record<string, number> = {
  "#51408d": 0,
  "#28547e": 1,
  "#235d5c": 2,
  "#345e40": 3,
  "#665721": 4,
  "#774d2f": 5,
  "#754156": 6,
  "#773f39": 7,
  "#a994e8": 0,
  "#79b4e5": 1,
  "#79c5ab": 3,
  "#e6b77d": 5,
  "#e994a8": 6,
  "#a8b3c9": 1,
};
export function courseColor(value: string) {
  const hex = value.toLowerCase();
  const exact = coursePalette.find((c) => c.day === hex || c.night === hex);
  if (exact) return exact;
  if (hex in legacy) return coursePalette[legacy[hex]];
  if (!/^#[0-9a-f]{6}$/.test(hex)) return coursePalette[0];
  const rgb = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const original = rgb(hex);
  return coursePalette.reduce((best, c) => {
    const distance = (h: string) =>
      rgb(h).reduce((s, v, i) => s + (v - original[i]) ** 2, 0);
    return Math.min(distance(c.day), distance(c.night)) <
      Math.min(distance(best.day), distance(best.night))
      ? c
      : best;
  });
}
export function courseColorStyle(value: string): CSSProperties {
  const c = courseColor(value);
  return { "--course-day": c.day, "--course-night": c.night } as CSSProperties;
}
