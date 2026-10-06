"use client";
import { useActionNotification } from "@/components/ui/action-notifications";
import { AssessmentEditor } from "@/components/grades/assessment-editor";
import { assessmentCalendarDate, type Assessment } from "@/lib/domain/grades";
import { useCallback, useEffect, useRef, useState } from "react";
import { TaskList } from "@/components/tasks/task-list";
import { TaskEditor } from "@/components/tasks/task-editor";
import { taskCalendarDate, type Task } from "@/lib/domain/tasks";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import type { EventChangeArg, EventSourceFuncArg } from "@fullcalendar/core";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Surface, Button, IconButton } from "@/components/ui/primitives";
import { SemesterProgress } from "@/components/semesters/progress";
import { calendarRange, saveEvent } from "@/lib/actions/academic";
import { courseColor } from "@/lib/domain/course-colors";
import { nextItems } from "@/lib/domain/home";
import type { EditorAnchor } from "@/components/ui/editor-dialog";
import { ScheduleEditor } from "@/components/schedules/schedule-editor";
import type { CalendarItem } from "@/lib/domain/recurrence";
import { EventEditor } from "./event-editor";
import type { Course, Semester } from "@/lib/supabase/database.types";
const plugins = [dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin];
export function OrbitCalendar({
  semester,
  courses,
  zone,
  upcoming,
  tasks,
  assessments,
  home = false,
}: {
  semester: Semester;
  courses: Course[];
  zone: string;
  upcoming: CalendarItem[];
  tasks: Task[];
  assessments: Assessment[];
  home?: boolean;
}) {
  const [anchor, setAnchor] = useState<{
    id: string;
    rect: EditorAnchor;
  } | null>(null);
  const [assessmentEditor, setAssessmentEditor] = useState<Assessment | null>(
    null,
  );
  const [taskEditor, setTaskEditor] = useState<Task | null>(null);
  const calendar = useRef<FullCalendar>(null);
  const notify = useActionNotification();
  const router = useRouter();
  const busy = useRef(false);
  const [editor, setEditor] = useState<Partial<CalendarItem> | null>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState("timeGridWeek");
  const [date, setDate] = useState(DateTime.now().setZone(zone).toISODate()!);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const archived = !!semester.archived_at;
  const events = useCallback(
    async (range: EventSourceFuncArg) => {
      const result = await calendarRange(
        semester.id,
        range.startStr,
        range.endStr,
      );
      if (result.error) {
        setError(result.error);
        throw new Error(result.error);
      }
      setError(
        result.skipped
          ? "A meeting was skipped because its local time does not exist during a daylight-saving change."
          : "",
      );
      return [
        ...result.data!.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.starts_at,
          end: e.ends_at,
          classNames: [`course-tone-${courseColor(e.color).id}`],
          extendedProps: {
            record: e,
          },
        })),
        ...(result.assessments ?? []).map((a) => ({
          id: `assessment:${a.id}`,
          title: a.name,
          start: assessmentCalendarDate(a, zone)!,
          allDay: !a.due_time,
          editable: false,
          durationEditable: false,
          classNames: ["orbit-assessment-marker"],
          extendedProps: { assessment: a },
        })),
        ...(result.tasks ?? []).map((task) => ({
          id: `task:${task.id}`,
          title: task.title,
          start: taskCalendarDate(task, zone)!,
          allDay: !task.due_time,
          editable: false,
          durationEditable: false,
          classNames: [
            "orbit-task-marker",
            ...(task.completed_at ? ["orbit-task-done"] : []),
          ],
          extendedProps: { task },
        })),
      ];
    },
    [semester.id, zone],
  );
  // Refresh only while idle; replacing event objects during a gesture invalidates it.
  useEffect(() => {
    const refresh = () => {
      if (
        !busy.current &&
        !document.querySelector("dialog[open]") &&
        document.visibilityState === "visible"
      )
        calendar.current?.getApi().refetchEvents();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const change = async (info: EventChangeArg) => {
    if (!info.event) {
      setError("The calendar refreshed during this gesture. Try again.");
      calendar.current?.getApi().refetchEvents();
      return;
    }
    if (saving) {
      info.revert();
      return;
    }
    busy.current = true;
    setSaving(true);

    setError("");
    const record = info.event.extendedProps.record as CalendarItem;
    if (record.recurring) {
      const proposed = {
        ...record,
        starts_at: info.event.start!.toISOString(),
        ends_at: info.event.end!.toISOString(),
      };
      info.revert();
      busy.current = false;
      setSaving(false);
      setEditor(proposed);
      return;
    }
    const form = new FormData();
    Object.entries({
      ...record,
      course_id: record.course_id ?? "",
      starts_at: info.event.start!.toISOString(),
      ends_at: info.event.end!.toISOString(),
    }).forEach(([k, v]) => form.set(k, String(v)));
    try {
      const result = await saveEvent(form);
      if (result.error) {
        info.revert();
        setError(result.error);
      } else {
        info.event.setExtendedProp("record", {
          ...record,
          revision: result.revision,
          starts_at: info.event.start!.toISOString(),
          ends_at: info.event.end!.toISOString(),
        });
        notify({ title: "Event updated", detail: record.title });
        calendar.current?.getApi().refetchEvents();
        router.refresh();
      }
    } catch {
      info.revert();
      setError("Connection interrupted. The event was not moved.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const month = DateTime.fromISO(date, { zone }).startOf("month");
  const grid = month.minus({ days: month.weekday % 7 });
  const next = nextItems(upcoming, tasks, assessments, zone);
  return (
    <div className="home-layout">
      <Surface className="orbit-calendar" aria-label="Calendar">
        <div className="calendar-toolbar">
          <div>
            <h2 className="calendar-month">{title}</h2>
            <span className="calendar-range">{zone}</span>
          </div>
          <div className="calendar-toolbar-right">
            <div className="calendar-views" aria-label="Calendar view">
              {[
                ["dayGridMonth", "Month"],
                ["timeGridWeek", "Week"],
                ["timeGridDay", "Day"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => calendar.current?.getApi().changeView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="calendar-command-row">
          <div>
            <IconButton
              label="Previous period"
              onClick={() => calendar.current?.getApi().prev()}
            >
              <ChevronLeft size={16} />
            </IconButton>
            <Button
              variant="ghost"
              onClick={() => calendar.current?.getApi().today()}
            >
              Today
            </Button>
            <IconButton
              label="Next period"
              onClick={() => calendar.current?.getApi().next()}
            >
              <ChevronRight size={16} />
            </IconButton>
          </div>
          {!archived && (
            <Button
              variant="primary"
              onClick={() =>
                setEditor({
                  id: crypto.randomUUID(),
                  starts_at: DateTime.fromISO(date, { zone })
                    .set({ hour: 9 })
                    .toISO()!,
                })
              }
            >
              <Plus size={15} />
              New event
            </Button>
          )}
        </div>
        <div className="calendar-feedback" aria-live="polite">
          {loading
            ? "Loading events…"
            : saving
              ? "Saving…"
              : archived
                ? "Archived semester · Read only"
                : "Click a time to add an event"}
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}{" "}
            <Button onClick={() => calendar.current?.getApi().refetchEvents()}>
              Retry
            </Button>
          </div>
        )}
        <div className="functional-calendar">
          <FullCalendar
            ref={calendar}
            plugins={plugins}
            initialView="timeGridWeek"
            timeZone={zone}
            firstDay={0}
            headerToolbar={false}
            height={650}
            viewDidMount={({ el }) => {
              el.querySelectorAll<HTMLElement>(
                ".fc-scroller-liquid-absolute",
              ).forEach((scroller) => {
                // Focus a real grid cell so FullCalendar's grid semantics stay intact.
                const cell =
                  scroller.querySelector<HTMLElement>('[role="gridcell"]');
                if (cell) cell.tabIndex = 0;
              });
            }}
            dayHeaderContent={(info) => {
              const d = DateTime.fromJSDate(info.date, { zone });
              return (
                <div className="calendar-day-label">
                  <span>{d.toFormat("ccc")}</span>
                  {info.view.type !== "dayGridMonth" && (
                    <strong>{d.day}</strong>
                  )}
                </div>
              );
            }}
            allDaySlot={true}
            allDayText="Due"
            scrollTime="08:00:00"
            nowIndicator
            editable={!archived && !saving && !loading}
            eventResizableFromStart={!archived}
            selectable={!archived}
            events={events}
            loading={setLoading}
            eventDragStart={() => {
              busy.current = true;
            }}
            eventDragStop={() => {
              busy.current = false;
            }}
            eventResizeStart={() => {
              busy.current = true;
            }}
            eventResizeStop={() => {
              busy.current = false;
            }}
            eventDrop={change}
            eventResize={change}
            eventClick={(info) => {
              const r = info.el.getBoundingClientRect();
              setAnchor({
                id: info.event.id,
                rect: { left: r.left, right: r.right, top: r.top },
              });
              return info.event.extendedProps.assessment
                ? setAssessmentEditor(info.event.extendedProps.assessment)
                : info.event.extendedProps.task
                  ? setTaskEditor(info.event.extendedProps.task)
                  : setEditor(info.event.extendedProps.record);
            }}
            dateClick={(info) => {
              if (!archived)
                setEditor({
                  id: crypto.randomUUID(),
                  starts_at: info.allDay
                    ? DateTime.fromISO(info.dateStr, { zone })
                        .set({ hour: 9 })
                        .toISO()!
                    : info.date.toISOString(),
                });
            }}
            select={(info) => {
              if (!info.allDay)
                setEditor({
                  id: crypto.randomUUID(),
                  starts_at: info.start.toISOString(),
                  ends_at: info.end.toISOString(),
                });
              calendar.current?.getApi().unselect();
            }}
            datesSet={(info) => {
              setTitle(info.view.title);
              setView(info.view.type);
              setDate(
                DateTime.fromJSDate(
                  calendar.current?.getApi().getDate() ??
                    info.view.currentStart,
                  { zone },
                ).toISODate()!,
              );
            }}
            eventContent={(info) =>
              info.event.extendedProps.assessment ? (
                <div className="orbit-event">
                  <strong>◇ {info.event.title}</strong>
                  <span>{info.timeText} · Assessment</span>
                </div>
              ) : info.event.extendedProps.task ? (
                <div className="orbit-event">
                  <strong>
                    {info.event.extendedProps.task.completed_at ? "✓" : "□"}{" "}
                    {info.event.title}
                  </strong>
                  <span>{info.timeText} · Task due</span>
                </div>
              ) : (
                <div className="orbit-event">
                  <strong>{info.event.title}</strong>
                  <span>{info.timeText}</span>
                  {info.event.extendedProps.record.location && (
                    <small>{info.event.extendedProps.record.location}</small>
                  )}
                  {courses.find(
                    (c) => c.id === info.event.extendedProps.record.course_id,
                  )?.code && (
                    <small>
                      {
                        courses.find(
                          (c) =>
                            c.id === info.event.extendedProps.record.course_id,
                        )?.code
                      }
                    </small>
                  )}
                </div>
              )
            }
            eventDidMount={(info) => {
              info.el.setAttribute(
                "aria-label",
                `${info.event.extendedProps.assessment ? "Assessment due: " : info.event.extendedProps.task ? "Task due: " : ""}${info.event.title}, ${info.timeText}${info.event.extendedProps.record?.location ? `, ${info.event.extendedProps.record.location}` : ""}`,
              );
            }}
          />
        </div>
      </Surface>
      <aside className="support-column" aria-label="Workspace overview">
        <Surface className="mini-calendar">
          <div className="support-heading">
            <h2>{month.toFormat("MMMM yyyy")}</h2>
          </div>
          <div className="mini-grid">
            {["S", "M", "T", "W", "T", "F", "S"].map((s, i) => (
              <span key={i} className="mini-weekday">
                {s}
              </span>
            ))}
            {Array.from({ length: 42 }, (_, i) => grid.plus({ days: i })).map(
              (d) => (
                <button
                  key={d.toISODate()}
                  className={`${d.month !== month.month ? "mini-muted" : ""} ${d.toISODate() === date ? "mini-selected" : ""}`}
                  aria-label={d.toFormat("MMMM d, yyyy")}
                  onClick={() =>
                    calendar.current?.getApi().gotoDate(d.toISODate()!)
                  }
                >
                  {d.day}
                </button>
              ),
            )}
          </div>
        </Surface>
        {!home && (
          <div className="compact-progress">
            <div className="support-heading">
              <h2>Semester progress</h2>
            </div>
            <SemesterProgress semester={semester} timezone={zone} />
          </div>
        )}
        <Surface className="next-up-placeholder">
          <h2>Next Up</h2>
          {next.length ? (
            next.map((item) => (
              <button
                className="upcoming-event"
                key={item.kind + item.id}
                onClick={() => {
                  if (item.kind === "Task") setTaskEditor(item.record as Task);
                  else if (item.kind === "Assessment")
                    setAssessmentEditor(item.record as Assessment);
                  else {
                    const e = item.record as CalendarItem;
                    calendar.current?.getApi().gotoDate(e.starts_at);
                    setEditor(e);
                  }
                }}
              >
                <span className="next-type" aria-hidden="true">
                  {item.kind === "Task"
                    ? "□"
                    : item.kind === "Assessment"
                      ? "◇"
                      : "◷"}
                </span>
                <span>
                  <small className="next-kind">{item.kind}</small>
                  <strong>{item.title}</strong>
                  <small>
                    {DateTime.fromISO(item.date).toFormat("ccc, MMM d")}
                    {item.time
                      ? " · " +
                        DateTime.fromISO(item.date + "T" + item.time, {
                          zone,
                        }).toFormat("h:mm a")
                      : " · All day"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p>No upcoming items in this semester.</p>
          )}
        </Surface>
        <TaskList
          compact
          tasks={tasks}
          courses={courses}
          semester={semester}
          zone={zone}
          onUpdated={() => calendar.current?.getApi().refetchEvents()}
        />
      </aside>
      {assessmentEditor &&
        courses.find((c) => c.id === assessmentEditor.course_id) && (
          <AssessmentEditor
            assessment={assessmentEditor}
            course={courses.find((c) => c.id === assessmentEditor.course_id)!}
            zone={zone}
            readOnly={archived}
            onClose={() => setAssessmentEditor(null)}
            onSaved={() => {
              setAssessmentEditor(null);
              calendar.current?.getApi().refetchEvents();
              router.refresh();
            }}
          />
        )}
      {taskEditor && (
        <TaskEditor
          task={taskEditor}
          courses={courses}
          semester={semester.id}
          zone={zone}
          readOnly={archived}
          onClose={() => setTaskEditor(null)}
          onSaved={() => {
            setTaskEditor(null);
            calendar.current?.getApi().refetchEvents();
            router.refresh();
          }}
        />
      )}
      {editor?.recurring ? (
        <ScheduleEditor
          meeting={editor as CalendarItem}
          course={courses.find((c) => c.id === editor.course_id)}
          semester={semester}
          zone={zone}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);

            calendar.current?.getApi().refetchEvents();
            router.refresh();
          }}
        />
      ) : (
        editor && (
          <EventEditor
            anchor={anchor && anchor.id === editor.id ? anchor.rect : undefined}
            event={editor}
            courses={courses}
            semester={semester.id}
            zone={zone}
            readOnly={archived}
            onClose={() => setEditor(null)}
            onSaved={() => {
              setEditor(null);

              calendar.current?.getApi().refetchEvents();
              router.refresh();
            }}
          />
        )
      )}
    </div>
  );
}
