"use client";
import { courseColorStyle } from "@/lib/domain/course-colors";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { AssessmentEditor } from "./assessment-editor";
import {
  summarizeGrades,
  assessmentResult,
  type Assessment,
} from "@/lib/domain/grades";
import type { Course, Semester } from "@/lib/supabase/database.types";
function Metrics({
  items,
  detail = false,
}: {
  items: Assessment[];
  detail?: boolean;
}) {
  const s = summarizeGrades(items);
  return (
    <dl className={`grade-metrics ${detail ? "grade-metrics-detail" : ""}`}>
      <div>
        <dt>Current Grade</dt>
        <dd>{s.current === null ? "No grades yet" : `${s.current}%`}</dd>
      </div>
      <div>
        <dt>Graded Coverage</dt>
        <dd>
          {s.coverage}% <small>graded</small>
        </dd>
      </div>
      <div>
        <dt>Earned Course Points</dt>
        <dd>
          {s.earned} <small>/ 100 earned</small>
        </dd>
      </div>
    </dl>
  );
}
export function GradeWorkspace({
  courses,
  items,
  semester,
  zone,
  course,
}: {
  courses: Course[];
  items: Assessment[];
  semester: Semester;
  zone: string;
  course?: Course;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<Partial<Assessment> | null>(null);
  const assessments = items.filter((a) => a.course_id === course?.id),
    summary = summarizeGrades(assessments),
    archived = !!semester.archived_at;
  if (!course)
    return (
      <div className="grade-overview">
        {!courses.length ? (
          <p className="task-empty">
            No courses in this semester.{" "}
            <Link href="/courses">Open courses</Link>
          </p>
        ) : (
          courses.map((c) => (
            <Link
              className="grade-course-row"
              href={`/grades?course=${c.id}`}
              key={c.id}
            >
              <div className="grade-course-name">
                <span
                  className="course-swatch"
                  style={courseColorStyle(c.color)}
                />
                <div>
                  <span className="eyebrow">{c.code}</span>
                  <h2>{c.name}</h2>
                </div>
              </div>
              <Metrics items={items.filter((a) => a.course_id === c.id)} />
            </Link>
          ))
        )}
      </div>
    );
  return (
    <div className="grade-detail">
      <div className="grade-detail-nav">
        <Link href="/grades">← All courses</Link>
        <label>
          Course
          <select
            aria-label="Grade course"
            value={course.id}
            onChange={(e) => router.push(`/grades?course=${e.target.value}`)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Metrics items={assessments} detail />
      <p className="field-help">
        Current Grade uses scored assessments only. Earned Course Points are
        contributions toward the final 100 points.
      </p>
      <div className="grade-weight">
        <span>
          {summary.configured}% configured · {summary.remaining}% unconfigured
        </span>
        {summary.weightWarning && (
          <strong role="status">{summary.weightWarning}</strong>
        )}
      </div>
      {archived && <p className="field-help">Archived semester · Read only</p>}
      <div className="task-heading">
        <h2>Assessments</h2>
        {!archived && (
          <Button variant="primary" onClick={() => setEditor({})}>
            <Plus size={15} /> Add assessment
          </Button>
        )}
      </div>
      {!assessments.length ? (
        <p className="task-empty">No assessments yet.</p>
      ) : (
        <div className="assessment-table-wrap">
          <table className="assessment-table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Weight</th>
                <th>Contribution</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const result = assessmentResult(a);
                return (
                  <tr key={a.id}>
                    <td>
                      <button
                        className="assessment-edit"
                        onClick={() => setEditor(a)}
                        aria-label={`${archived ? "View" : "Edit"} assessment ${a.name}`}
                      >
                        {a.name}
                      </button>
                    </td>
                    <td>
                      {a.score_earned === null
                        ? `Ungraded / ${a.score_possible}`
                        : `${a.score_earned} / ${a.score_possible}`}
                    </td>
                    <td>
                      {result.percentage === null
                        ? "—"
                        : `${result.percentage}%`}
                    </td>
                    <td>{a.weight}%</td>
                    <td>
                      {result.contribution === null
                        ? "—"
                        : `${result.contribution} pts`}
                    </td>
                    <td>
                      {a.due_date ?? "—"}
                      {a.due_time && <small> · {a.due_time.slice(0, 5)}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editor && (
        <AssessmentEditor
          assessment={editor}
          course={course}
          zone={zone}
          readOnly={archived}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);

            router.refresh();
          }}
        />
      )}
    </div>
  );
}
