"use client";
import { useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/primitives";
export function PreviewInfo() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="preview-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        Design preview <ArrowUpRight size={13} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby="preview-title"
        aria-describedby="preview-description"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-header">
          <span className="eyebrow">ORBIT · PHASE 01</span>
          <IconButton
            label="Close preview information"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </IconButton>
        </div>
        <h2 id="preview-title">The beginning of your space.</h2>
        <p id="preview-description">
          This preview establishes Orbit’s look and feel. Explore the navigation
          and try light, dark, or system appearance.
        </p>
        <p>
          The calendar is a static layout study. Your semester, events, and
          academic tools will arrive in later phases.
        </p>
        <Button variant="primary" onClick={() => dialog.current?.close()}>
          Back to Orbit
        </Button>
      </dialog>
    </>
  );
}
