import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Surface } from "@/components/ui/primitives";
// Deliberately static design specimen. No date state, events, or calendar behavior.
export function CalendarPreview() {
  return (
    <Surface
      className="calendar-preview"
      aria-label="Static weekly calendar layout preview"
    >
      <div className="calendar-toolbar">
        <div>
          <div className="calendar-month">
            October <span>2026</span>
          </div>
          <span className="calendar-range">
            October 4 – 10 · Layout preview
          </span>
        </div>
        <div className="calendar-toolbar-right">
          <div
            className="view-specimen"
            aria-label="Calendar view style preview"
          >
            <span>Month</span>
            <span className="view-selected">Week</span>
            <span>Day</span>
          </div>
          <div className="calendar-arrows" aria-hidden="true">
            <ChevronLeft size={16} />
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-canvas">
          <div className="week-header">
            <div className="timezone-label">GMT+3</div>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <div className="week-day" key={day}>
                <span>{day}</span>
                <strong>{i + 4}</strong>
              </div>
            ))}
          </div>
          <div className="week-body" aria-hidden="true">
            <div className="time-labels">
              {[
                "8 AM",
                "9 AM",
                "10 AM",
                "11 AM",
                "12 PM",
                "1 PM",
                "2 PM",
                "3 PM",
              ].map((time) => (
                <span key={time}>{time}</span>
              ))}
            </div>
            <div className="week-grid">
              {Array.from({ length: 7 }, (_, i) => (
                <div className="day-column" key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="calendar-center">
        <div className="calendar-empty-mark">
          <CalendarDays size={27} strokeWidth={1.35} />
        </div>
        <h2>Calendar preview</h2>
        <p>
          Event scheduling is not available yet.
          <br />
          This layout is a static preview.
        </p>
        <Badge>Calendar preview</Badge>
      </div>
      <div className="calendar-bottom">
        <span>
          <span className="status-dot" /> Static layout preview
        </span>
        <span>Nothing scheduled in this preview</span>
      </div>
    </Surface>
  );
}
export function MiniCalendarPreview() {
  return (
    <Surface className="mini-calendar" aria-label="Static month layout preview">
      <div className="support-heading">
        <h2>
          October <span>2026</span>
        </h2>
        <CalendarDays size={15} />
      </div>
      <div className="mini-grid" aria-hidden="true">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span className="mini-weekday" key={`day-${i}`}>
            {d}
          </span>
        ))}
        {[27, 28, 29, 30, ...Array.from({ length: 31 }, (_, i) => i + 1)].map(
          (d, i) => (
            <span
              key={i}
              className={
                i < 4
                  ? "mini-muted"
                  : i >= 7 && i <= 13
                    ? `mini-range ${i === 7 ? "range-start" : ""} ${i === 13 ? "range-end" : ""}`
                    : ""
              }
            >
              {d}
            </span>
          ),
        )}
      </div>
      <div className="mini-caption">Static month preview</div>
    </Surface>
  );
}
