"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, X } from "lucide-react";
export type ActionNotice = { title: string; detail?: string };
type Notice = ActionNotice & { id: number };
const Notifications = createContext<(notice: ActionNotice) => void>(() => {});
export const useActionNotification = () => useContext(Notifications);
function Notification({
  notice,
  remove,
}: {
  notice: Notice;
  remove: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  useEffect(() => {
    if (paused || leaving) return;
    const timer = setTimeout(() => setLeaving(true), 2900);
    return () => clearTimeout(timer);
  }, [paused, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => remove(notice.id), 240);
    return () => clearTimeout(timer);
  }, [leaving, notice.id, remove]);
  return (
    <div className={"action-notice-slot " + (leaving ? "is-leaving" : "")}>
      <div
        className="action-notice"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
        }}
      >
        <Check size={16} className="action-notice-icon" aria-hidden="true" />
        <div role="status" aria-atomic="true">
          <strong>{notice.title}</strong>
          {notice.detail && <span>{notice.detail}</span>}
        </div>
        <button
          type="button"
          aria-label={"Dismiss " + notice.title}
          onClick={() => setLeaving(true)}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
export function ActionNotifications({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const sequence = useRef(0);
  const notify = useCallback((notice: ActionNotice) => {
    const id = ++sequence.current;
    setQueue((current) => [...current, { ...notice, id }]);
  }, []);
  const remove = useCallback(
    (id: number) => setQueue((current) => current.filter((n) => n.id !== id)),
    [],
  );
  return (
    <Notifications.Provider value={notify}>
      {children}
      <aside className="action-notifications" aria-label="Action confirmations">
        {queue.slice(0, 3).map((notice) => (
          <Notification key={notice.id} notice={notice} remove={remove} />
        ))}
      </aside>
    </Notifications.Provider>
  );
}
