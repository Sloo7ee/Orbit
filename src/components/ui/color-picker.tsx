"use client";
import { useId, useState } from "react";
import {
  coursePalette,
  courseColor,
  courseColorStyle,
} from "@/lib/domain/course-colors";
export function ColorPicker({
  label,
  value,
  defaultValue = coursePalette[0].day,
  onChange,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
}) {
  const [local, setLocal] = useState(defaultValue),
    id = useId(),
    current = value ?? local;
  return (
    <fieldset className="palette-picker" aria-label={label}>
      <legend>{label}</legend>
      <input type="hidden" name="color" value={current} />
      <div className="palette-options">
        {coursePalette.map((c) => (
          <label key={c.id} style={courseColorStyle(c.day)}>
            <input
              type="radio"
              name={id}
              value={c.day}
              checked={courseColor(current).id === c.id}
              onChange={() => {
                setLocal(c.day);
                onChange?.(c.day);
              }}
            />
            <span className="palette-swatch" aria-hidden="true" />
            <span>{c.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
