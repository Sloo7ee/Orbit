"use client";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { useState } from "react";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/primitives";
import { changeAssessment } from "@/lib/actions/grades";
import { assessmentResult, type Assessment } from "@/lib/domain/grades";
import type { Course } from "@/lib/supabase/database.types";
export function AssessmentEditor({
  assessment,
  course,
  zone,
  readOnly,
  onClose,
  onSaved,
}: {
  assessment: Partial<Assessment>;
  course: Course;
  zone: string;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [id] = useState(() => assessment.id ?? crypto.randomUUID()),
    [request] = useState(() => crypto.randomUUID());
  const [deleting, setDeleting] = useState(false),
    [score, setScore] = useState(
      assessment.score_earned === null || assessment.score_earned === undefined
        ? ""
        : String(assessment.score_earned),
    );
  const [date, setDate] = useState(assessment.due_date ?? ""),
    [time, setTime] = useState(assessment.due_time?.slice(0, 5) ?? "");
  return (
    <EditorDialog
      title={
        deleting
          ? "Delete assessment?"
          : assessment.revision
            ? "Assessment details"
            : "Add assessment"
      }
      onClose={onClose}
    >
      <p>
        {course.code} · {course.name}
      </p>
      {readOnly ? (
        <div>
          <h3>{assessment.name}</h3>
          <p>
            {assessment.score_earned === null
              ? "Ungraded"
              : `${assessment.score_earned} / ${assessment.score_possible} · ${assessmentResult(assessment as Assessment).percentage}%`}{" "}
            · Weight {assessment.weight}%
          </p>
          <p>
            {assessment.due_date ?? "No due date"}{" "}
            {assessment.due_time?.slice(0, 5)}
          </p>
          <p className="task-description">{assessment.notes}</p>
          <p>Archived semester · Read only</p>
        </div>
      ) : (
        <>
          {deleting && (
            <p>
              Permanently delete “{assessment.name}” and its score? The course
              totals will be recalculated.
            </p>
          )}
          <ActionForm
            key={String(deleting)}
            successMessage={
              deleting
                ? "Assessment deleted"
                : assessment.revision
                  ? "Assessment updated"
                  : "Assessment added"
            }
            successDetail={deleting ? assessment.name : undefined}
            action={changeAssessment}
            className="assessment-form"
            revision={assessment.revision ?? 0}
            submitLabel={deleting ? "Delete assessment" : "Save assessment"}
            onSuccess={onSaved}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="request_id" value={request} />
            <input type="hidden" name="course_id" value={course.id} />
            <input
              type="hidden"
              name="semester_id"
              value={course.semester_id}
            />
            <input type="hidden" name="delete" value={String(deleting)} />
            {!deleting && (
              <>
                <label>
                  Name
                  <input
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={assessment.name}
                  />
                </label>
                <label>
                  Weight (%)
                  <input
                    name="weight"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max="100"
                    required
                    defaultValue={assessment.weight}
                  />
                </label>
                <div className="form-row">
                  <div>
                    <label>
                      Score earned
                      <input
                        name="score_earned"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                      />
                    </label>
                    {score !== "" && (
                      <Button variant="ghost" onClick={() => setScore("")}>
                        Clear score
                      </Button>
                    )}
                  </div>
                  <label>
                    Score possible
                    <input
                      name="score_possible"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max="1000000000"
                      required
                      defaultValue={assessment.score_possible}
                    />
                  </label>
                </div>
                <p className="field-help">
                  Leave earned score blank until graded. Zero is a graded score.
                  Up to four decimal places.
                </p>
                <div className="form-row">
                  <DatePicker
                    label="Due date"
                    zone={zone}
                    name="due_date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={date}
                    onValueChange={(value) => {
                      setDate(value);
                      if (!value) setTime("");
                    }}
                  />
                  <div>
                    <TimePicker
                      label="Due time"
                      name="due_time"
                      disabled={!date}
                      value={time}
                      onValueChange={(value) => setTime(value)}
                    />
                    {time && date && (
                      <Button variant="ghost" onClick={() => setTime("")}>
                        Remove due time
                      </Button>
                    )}
                  </div>
                </div>
                {!date && <input type="hidden" name="due_time" value="" />}
                <p className="field-help">
                  Optional time · {zone}. Date-only assessments have no
                  assigned time.
                </p>
                <label>
                  Notes (optional)
                  <textarea
                    name="notes"
                    rows={2}
                    maxLength={4000}
                    defaultValue={assessment.notes}
                  />
                </label>
              </>
            )}
          </ActionForm>
          {assessment.revision && (
            <Button variant="ghost" onClick={() => setDeleting(!deleting)}>
              {deleting ? "Keep assessment" : "Delete assessment"}
            </Button>
          )}
        </>
      )}
    </EditorDialog>
  );
}
