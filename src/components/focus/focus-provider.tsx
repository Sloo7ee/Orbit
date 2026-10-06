"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { changeFocus, readFocus } from "@/lib/actions/focus";
import type { FocusCommand, FocusSnapshot } from "@/lib/domain/focus";
type Controller = {
  snapshot: FocusSnapshot;
  now: number;
  busy: boolean;
  error: string;
  run: (v: Omit<FocusCommand, "request">) => Promise<boolean>;
  refresh: () => Promise<void>;
};
const Context = createContext<Controller | null>(null);
export function FocusProvider({
  initial,
  children,
}: {
  initial: FocusSnapshot;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(initial),
    [now, setNow] = useState(Date.parse(initial.server_now)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const offset = useRef(0),
    pending = useRef(false),
    reading = useRef(false),
    receipt = useRef<{ signature: string; id: string } | null>(null);
  const latest = useRef(Date.parse(initial.server_now));
  const accept = useCallback((next: FocusSnapshot) => {
    const stamp = Date.parse(next.server_now);
    if (stamp < latest.current) return false;
    latest.current = stamp;
    setSnapshot(next);
    offset.current = Date.parse(next.server_now) - Date.now();
    setNow(Date.parse(next.server_now));
    return true;
  }, []);
  useEffect(() => {
    offset.current = latest.current - Date.now();
  }, []);
  const refresh = useCallback(async () => {
    if (pending.current || reading.current) return;
    reading.current = true;
    try {
      const result = await readFocus(initial.semester_id);
      if (!pending.current) {
        if (result.snapshot) {
          if (accept(result.snapshot)) setError("");
        } else setError(result.error ?? "Could not refresh Focus.");
      }
    } catch {
      setError("Could not refresh Focus. Check your connection and retry.");
    } finally {
      reading.current = false;
    }
  }, [accept, initial.semester_id]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const poll = setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh]);
  const run = useCallback(
    async (v: Omit<FocusCommand, "request">) => {
      if (pending.current) return false;
      pending.current = true;
      setBusy(true);
      setError("");
      const signature = JSON.stringify(v);
      if (receipt.current?.signature !== signature)
        receipt.current = { signature, id: crypto.randomUUID() };
      try {
        const result = await changeFocus({ ...v, request: receipt.current.id });
        if (result.snapshot) {
          accept(result.snapshot);
          receipt.current = null;
          return true;
        }
        setError(result.error ?? "Could not save Focus.");
        return false;
      } catch {
        setError(
          "Connection interrupted. Your timer remains at its last confirmed state. Retry or refresh Focus.",
        );
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [accept],
  );
  return (
    <Context.Provider value={{ snapshot, now, busy, error, run, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useFocus() {
  const c = useContext(Context);
  if (!c) throw new Error("FocusProvider required");
  return c;
}
