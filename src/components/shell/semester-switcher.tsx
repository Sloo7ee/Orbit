"use client";
import { useActionNotification } from "@/components/ui/action-notifications";
import { useNoteDraft } from "@/components/notes/draft-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers3 } from "lucide-react";
import Link from "next/link";
import { selectSemester } from "@/lib/actions/workspace";
import type { Semester } from "@/lib/supabase/database.types";
export function SemesterSwitcher({
  semesters,
  selected,
}: {
  semesters: Semester[];
  selected: Semester | null;
}) {
  const router = useRouter();
  const notify = useActionNotification();
  const { store } = useNoteDraft();
  const [pending, transition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="semester-switcher">
      <div className="semester-select-wrap">
        <Layers3 size={17} aria-hidden="true" />
        <select
          aria-label="Selected semester"
          value={selected?.id ?? ""}
          disabled={pending || !semesters.length}
          onChange={(e) => {
            const data = new FormData();
            data.set("id", e.target.value);
            setError("");
            transition(async () => {
              try {
                if (!(await store.flush())) {
                  setError(
                    "Save or resolve your note draft before switching semesters.",
                  );
                  return;
                }
                const result = await selectSemester(data);
                if (result.error) setError(result.error);
                else {
                  notify({
                    title: "Semester selected",
                    detail: semesters.find((s) => s.id === data.get("id"))
                      ?.name,
                  });
                  router.refresh();
                }
              } catch {
                setError("Could not switch. Try again.");
              }
            });
          }}
        >
          <option value="" disabled>
            {semesters.length ? "Choose a semester" : "No semester yet"}
          </option>
          {[false, true].map((archived) => (
            <optgroup
              key={String(archived)}
              label={archived ? "History" : "Active"}
            >
              {semesters
                .filter((s) => !!s.archived_at === archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <Link
        href="/semesters"
        className="manage-semesters"
        title="Manage semesters"
      >
        Manage semesters
      </Link>
      {pending && (
        <span role="status" className="field-help">
          Switching…
        </span>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
