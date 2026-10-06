"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { NoteDraft } from "@/lib/domain/note-draft";
import { changeNote } from "@/lib/actions/notes";
import { Button } from "@/components/ui/primitives";
const Context = createContext<NoteDraft | null>(null);
export function useNoteDraft() {
  const store = useContext(Context);
  if (!store) throw new Error("Notes draft provider missing");
  const state = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot,
  );
  return { store, state };
}
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => new NoteDraft(changeNote));
  const state = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot,
  );
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (store.state.dirty || store.state.saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (
        !a ||
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        (!store.state.dirty && !store.state.saving)
      )
        return;
      const url = new URL(a.href, location.href);
      if (
        url.origin !== location.origin ||
        (url.pathname === location.pathname && url.search === location.search)
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      void store.flush().then((ok) => {
        if (ok) router.push(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [store, router]);
  return (
    <Context.Provider value={store}>
      {pathname !== "/notes" && state.dirty && (
        <div className="draft-banner" role={state.error ? "alert" : "status"}>
          {state.error || "Saving your note…"}{" "}
          <Button onClick={() => router.push("/notes")}>Return to draft</Button>
          {state.error && (
            <Button onClick={() => void store.flush()}>Retry</Button>
          )}
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
