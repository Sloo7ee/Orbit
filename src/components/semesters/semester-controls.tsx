"use client";
import { DatePicker } from "@/components/ui/date-time-picker";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import {
  createSemester,
  archiveSemester,
  selectSemester,
} from "@/lib/actions/workspace";
import { Button, IconButton } from "@/components/ui/primitives";
import type { Semester } from "@/lib/supabase/database.types";
export function CreateSemester({
  requestId,
  zone,
}: {
  requestId: string;
  zone: string;
}) {
  const [stableId] = useState(requestId);
  return (
    <ActionForm
      action={createSemester}
      successMessage="Semester created and selected"
      submitLabel="Create semester"
      pendingLabel="Creating…"
    >
      <input type="hidden" name="id" value={stableId} />
      <label>
        Semester name
        <input
          name="name"
          required
          maxLength={100}
          placeholder="e.g. Fall 2026"
        />
      </label>
      <div className="form-row">
        <DatePicker
          label="Start date"
          zone={zone}
          name="start_date"
          required
          min="1900-01-01"
          max="9999-12-31"
        />
        <DatePicker
          label="End date"
          zone={zone}
          name="end_date"
          required
          min="1900-01-01"
          max="9999-12-31"
        />
      </div>
      <p className="field-help">The end date is included in your semester.</p>
    </ActionForm>
  );
}
export function SemesterActions({
  semester,
  selected,
}: {
  semester: Semester;
  selected: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const archived = !!semester.archived_at;
  return (
    <div className="semester-actions">
      {!selected && (
        <ActionForm
          action={selectSemester}
          successMessage="Semester selected"
          successDetail={semester.name}
          submitLabel={archived ? "View history" : "Select semester"}
        >
          <input type="hidden" name="id" value={semester.id} />
        </ActionForm>
      )}
      <Button variant="ghost" onClick={() => dialog.current?.showModal()}>
        {archived ? "Restore" : "Archive"}
      </Button>
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby={`archive-title-${semester.id}`}
      >
        <div className="dialog-header">
          <span className="eyebrow">SEMESTER</span>
          <IconButton label="Cancel" onClick={() => dialog.current?.close()}>
            <X size={18} />
          </IconButton>
        </div>
        <h2 id={`archive-title-${semester.id}`}>
          {archived ? "Restore" : "Archive"} {semester.name}?
        </h2>
        <p>
          {archived
            ? "This semester will return to your active list."
            : "This semester will move to history. Its data will be preserved and you can restore it at any time."}
        </p>
        <ActionForm
          action={archiveSemester}
          successMessage={archived ? "Semester restored" : "Semester archived"}
          successDetail={semester.name}
          submitLabel={archived ? "Restore semester" : "Archive semester"}
          onSuccess={() => dialog.current?.close()}
        >
          <input type="hidden" name="id" value={semester.id} />
          <input type="hidden" name="revision" value={semester.revision} />
          <input type="hidden" name="archive" value={String(!archived)} />
        </ActionForm>
      </dialog>
    </div>
  );
}
