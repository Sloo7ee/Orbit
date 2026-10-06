"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./primitives";
export type EditorAnchor = { left: number; right: number; top: number };
export function EditorDialog({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string;
  anchor?: EditorAnchor;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const place = () => {
      if (window.innerWidth < 960) {
        el.removeAttribute("style");
        return;
      }
      const width = el.offsetWidth,
        height = el.offsetHeight;
      const preferredLeft =
        anchor.right + 16 + width < window.innerWidth - 20
          ? anchor.right + 16
          : Math.max(20, anchor.left - width - 16);
      const left = Math.max(
        20,
        Math.min(preferredLeft, window.innerWidth - width - 20),
      );
      Object.assign(el.style, {
        margin: "0",
        position: "fixed",
        left: `${left}px`,
        top: `${Math.max(20, Math.min(anchor.top, window.innerHeight - height - 20))}px`,
      });
    };
    place();
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => {
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [anchor]);
  return (
    <dialog
      className={`dialog editor-dialog ${anchor ? "anchored-editor" : ""}`}
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <IconButton label="Close editor" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
