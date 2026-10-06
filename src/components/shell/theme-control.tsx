"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
const modes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;
const subscribe = () => () => {};
export function ThemeControl({ expanded = false }: { expanded?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div
      className={`theme-control ${expanded ? "theme-control--expanded" : ""}`}
      role="group"
      aria-label="Appearance"
    >
      {modes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className={`theme-choice theme-choice--${value}`}
          onClick={() => setTheme(value)}
          aria-pressed={mounted ? theme === value : false}
          aria-label={`${label} appearance`}
          title={
            value === "light"
              ? "Orbit Day"
              : value === "dark"
                ? "Orbit Night"
                : "System appearance"
          }
        >
          <Icon size={16} aria-hidden="true" />
          <span>
            {value === "light"
              ? "Orbit Day"
              : value === "dark"
                ? "Orbit Night"
                : label}
          </span>
        </button>
      ))}
    </div>
  );
}
