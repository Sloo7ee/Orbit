"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function SessionRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        !document.querySelector(
          'form[data-dirty="true"], [data-note-dirty="true"], fieldset[aria-busy="true"], dialog[open]',
        )
      )
        router.refresh();
    };
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return null;
}
