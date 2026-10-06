"use client";
import {
  useLayoutEffect,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DateTime } from "luxon";
import { CalendarDays, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./primitives";
import { parsePickerTime, displayPickerTime } from "@/lib/domain/picker-time";

type FieldProps = {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  zone?: string;
};
function PickerPanel({
  label,
  anchor,
  close,
  children,
}: {
  label: string;
  anchor: HTMLElement;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const place = () => {
      const b = (
        anchor.closest(".picker-trigger") ?? anchor
      ).getBoundingClientRect();
      const width = el.offsetWidth,
        height = el.offsetHeight;
      const below = b.bottom + 8;
      const top =
        below + height <= innerHeight - 12 ? below : b.top - height - 8;
      Object.assign(el.style, {
        left: `${Math.max(12, Math.min(b.left, innerWidth - width - 12))}px`,
        top: `${Math.max(12, Math.min(top, innerHeight - height - 12))}px`,
      });
    };
    el.showModal();
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      el.close();
      anchor.focus();
    };
  }, [anchor]);
  return (
    <dialog
      ref={ref}
      className="orbit-picker-panel"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
      onClose={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close();
        }
      }}
    >
      {children}
    </dialog>
  );
}
function DatePanel({
  value,
  min = "1900-01-01",
  max = "9999-12-31",
  zone,
  apply,
  close,
  anchor,
  label,
  optional,
}: {
  value: string;
  min?: string;
  max?: string;
  zone: string;
  apply: (v: string) => void;
  close: () => void;
  anchor: HTMLElement;
  label: string;
  optional: boolean;
}) {
  const today = DateTime.now().setZone(zone).toISODate()!;
  const initial = value || (today < min ? min : today > max ? max : today);
  const [draft, setDraft] = useState(value),
    [month, setMonth] = useState(initial.slice(0, 7)),
    [cursor, setCursor] = useState(initial);
  const grid = useRef<HTMLDivElement>(null);
  const [focusRequest, requestFocus] = useState(0);
  useLayoutEffect(() => {
    if (focusRequest)
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)
        ?.focus();
  }, [focusRequest, cursor, month]);
  const start = DateTime.fromISO(month + "-01", { zone: "UTC", locale: "en" });
  const first = start.minus({ days: start.weekday % 7 });
  const days = Array.from({ length: 42 }, (_, i) => first.plus({ days: i }));
  function move(date: string) {
    if (date < min || date > max) return;
    setCursor(date);
    setDraft(date);
    setMonth(date.slice(0, 7));
    requestFocus((n) => n + 1);
  }
  return (
    <PickerPanel label={`${label} picker`} anchor={anchor} close={close}>
      <div className="picker-month-heading">
        <Button
          aria-label="Previous month"
          disabled={
            start.minus({ months: 1 }).endOf("month").toISODate()! < min
          }
          onClick={() => {
            const m = start.minus({ months: 1 }).toFormat("yyyy-MM");
            setMonth(m);
            setCursor(m + "-01" < min ? min : m + "-01");
          }}
        >
          <ChevronLeft size={16} />
        </Button>
        <strong aria-live="polite">{start.toFormat("MMMM yyyy")}</strong>
        <Button
          aria-label="Next month"
          disabled={
            start.plus({ months: 1 }).toMillis() >
            DateTime.fromISO(max, { zone: "UTC" }).toMillis()
          }
          onClick={() => {
            const m = start.plus({ months: 1 }).toFormat("yyyy-MM");
            setMonth(m);
            setCursor(m + "-01" < min ? min : m + "-01");
          }}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label="Choose date"
        className="picker-date-grid"
      >
        <div role="row">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <span role="columnheader" key={d}>
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div role="row" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((d) => {
              const iso = d.toISODate()!;
              return (
                <button
                  type="button"
                  role="gridcell"
                  data-date={iso}
                  key={iso}
                  aria-label={d.toFormat("MMMM d, yyyy")}
                  aria-selected={draft === iso}
                  aria-current={iso === today ? "date" : undefined}
                  disabled={iso < min || iso > max}
                  tabIndex={cursor === iso ? 0 : -1}
                  className={d.month !== start.month ? "outside-month" : ""}
                  onClick={() => {
                    setDraft(iso);
                    setCursor(iso);
                  }}
                  onKeyDown={(e) => {
                    const offset = (
                      {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      } as Record<string, number>
                    )[e.key];
                    let next: DateTime | undefined;
                    if (offset) next = d.plus({ days: offset });
                    if (e.key === "Home")
                      next = d.minus({ days: d.weekday % 7 });
                    if (e.key === "End")
                      next = d.plus({ days: 6 - (d.weekday % 7) });
                    if (e.key === "PageUp") next = d.minus({ months: 1 });
                    if (e.key === "PageDown") next = d.plus({ months: 1 });
                    if (next) {
                      e.preventDefault();
                      move(next.toISODate()!);
                    }
                  }}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="picker-footer">
        <Button
          variant="ghost"
          disabled={today < min || today > max}
          onClick={() => move(today)}
        >
          Today
        </Button>
        {optional && (
          <Button variant="ghost" onClick={() => setDraft("")}>
            Clear
          </Button>
        )}
        <span />
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => apply(draft)}
          disabled={!optional && !draft}
        >
          Apply
        </Button>
      </div>
    </PickerPanel>
  );
}
function TimePanel({
  value,
  apply,
  close,
  anchor,
  label,
  optional,
}: {
  value: string;
  apply: (v: string) => void;
  close: () => void;
  anchor: HTMLElement;
  label: string;
  optional: boolean;
}) {
  const base = value || "09:00",
    h = Number(base.slice(0, 2));
  const [hour, setHour] = useState(String(h % 12 || 12)),
    [minute, setMinute] = useState(base.slice(3, 5)),
    [period, setPeriod] = useState(h < 12 ? "AM" : "PM");
  const valid =
    /^\d{1,2}$/.test(hour) &&
    Number(hour) >= 1 &&
    Number(hour) <= 12 &&
    /^\d{1,2}$/.test(minute) &&
    Number(minute) <= 59;
  return (
    <PickerPanel label={`${label} picker`} anchor={anchor} close={close}>
      <h3>Select time</h3>
      <div className="picker-time-controls">
        <label>
          Hour
          <input
            aria-label="Hour"
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={hour}
            onChange={(e) => setHour(e.target.value)}
          />
        </label>
        <span>:</span>
        <label>
          Minute
          <input
            aria-label="Minute"
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          />
        </label>
        <fieldset className="picker-period">
          <legend className="sr-only">Period</legend>
          {["AM", "PM"].map((p) => (
            <label key={p}>
              <input
                type="radio"
                name="picker-period"
                checked={period === p}
                onChange={() => setPeriod(p)}
              />
              <span>{p}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="picker-minutes" aria-label="Common minutes">
        {Array.from({ length: 12 }, (_, i) =>
          String(i * 5).padStart(2, "0"),
        ).map((m) => (
          <button
            type="button"
            aria-label={`${m} minutes`}
            aria-pressed={minute === m}
            key={m}
            onClick={() => setMinute(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="picker-footer">
        {optional && (
          <Button variant="ghost" onClick={() => apply("")}>
            Remove time
          </Button>
        )}
        <span />
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() =>
            apply(
              parsePickerTime(`${hour}:${minute.padStart(2, "0")} ${period}`)!,
            )
          }
        >
          Apply
        </Button>
      </div>
    </PickerPanel>
  );
}
function PickerField({
  kind,
  label,
  name,
  value,
  defaultValue = "",
  onValueChange,
  required,
  disabled,
  min = "1900-01-01",
  max = "9999-12-31",
  zone = "UTC",
}: FieldProps & { kind: "date" | "time" }) {
  const [local, setLocal] = useState(defaultValue),
    [editing, setEditing] = useState<string | null>(null),
    [open, setOpen] = useState<HTMLElement | null>(null);
  const [observed, setObserved] = useState(value);
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (wasDisabled !== disabled) {
    setWasDisabled(disabled);
    setEditing(null);
  }
  if (observed !== value) {
    setObserved(value);
    if (value !== local) {
      setLocal(value ?? "");
      setEditing(null);
    }
  }
  useEffect(() => {
    if (editing === null || disabled) input.current?.setCustomValidity("");
  }, [editing, disabled]);
  const current = value ?? local,
    id = useId(),
    button = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null);
  const display =
    kind === "date"
      ? current
        ? DateTime.fromISO(current, { zone: "UTC", locale: "en" }).toFormat(
            "MMM d, yyyy",
          )
        : ""
      : displayPickerTime(current);
  function update(v: string) {
    setLocal(v);
    onValueChange?.(v);
    input.current?.form?.setAttribute("data-dirty", "true");
  }
  function typed(raw: string) {
    setEditing(raw);
    const date = DateTime.fromISO(raw, { zone: "UTC", locale: "en" });
    const parsed =
      kind === "time"
        ? parsePickerTime(raw)
        : /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
            date.isValid &&
            raw >= min &&
            raw <= max
          ? raw
          : null;
    input.current?.setCustomValidity(
      raw && parsed === null
        ? kind === "date"
          ? `Enter a valid date between ${min} and ${max} (YYYY-MM-DD).`
          : "Enter a time such as 10:03 AM or 13:47."
        : "",
    );
    if (!raw || parsed !== null) update(parsed ?? "");
  }
  const Icon = kind === "date" ? CalendarDays : Clock;
  return (
    <div className="picker-field">
      <label htmlFor={id}>{label}</label>
      <div className="picker-trigger">
        <input
          ref={input}
          id={id}
          type="text"
          value={editing ?? display}
          required={required}
          disabled={disabled}
          placeholder={kind === "date" ? "No date" : "No time"}
          aria-describedby={`${id}-help`}
          autoComplete="off"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => typed(e.target.value)}
          onBlur={() => {
            if (input.current?.validity.valid) setEditing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              setOpen(e.currentTarget);
            }
          }}
        />
        <button
          ref={button}
          type="button"
          disabled={disabled}
          aria-label={`Choose ${label.toLowerCase()}`}
          aria-haspopup="dialog"
          aria-expanded={!!open}
          onClick={() => setOpen(button.current)}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      </div>
      <span id={`${id}-help`} className="sr-only">
        {kind === "date"
          ? "Type YYYY-MM-DD, or use the calendar button. Alt and Down Arrow opens the picker."
          : "Type HH:mm or a time with AM or PM, or use the clock button. Alt and Down Arrow opens the picker."}
      </span>
      <input type="hidden" name={name} value={current} disabled={disabled} />
      {open &&
        (kind === "date" ? (
          <DatePanel
            label={label}
            anchor={open}
            value={current}
            min={min}
            max={max}
            zone={zone}
            optional={!required}
            close={() => setOpen(null)}
            apply={(v) => {
              update(v);
              setEditing(null);
              input.current?.setCustomValidity("");
              setOpen(null);
            }}
          />
        ) : (
          <TimePanel
            label={label}
            anchor={open}
            value={current}
            optional={!required}
            close={() => setOpen(null)}
            apply={(v) => {
              update(v);
              setEditing(null);
              input.current?.setCustomValidity("");
              setOpen(null);
            }}
          />
        ))}
    </div>
  );
}
export function DatePicker(props: FieldProps) {
  return <PickerField {...props} kind="date" />;
}
export function TimePicker(props: FieldProps) {
  return <PickerField {...props} kind="time" />;
}
export function DateTimePicker({
  label,
  name,
  defaultValue = "",
  zone,
}: FieldProps) {
  const [date, setDate] = useState(defaultValue.slice(0, 10)),
    [time, setTime] = useState(defaultValue.slice(11, 16));
  return (
    <div className="picker-datetime">
      <div className="form-row">
        <DatePicker
          label={`${label} date`}
          required
          value={date}
          onValueChange={setDate}
          zone={zone}
        />
        <TimePicker
          label={`${label} time`}
          required
          value={time}
          onValueChange={setTime}
        />
      </div>
      <input
        type="hidden"
        name={name}
        value={date && time ? `${date}T${time}` : ""}
      />
    </div>
  );
}
