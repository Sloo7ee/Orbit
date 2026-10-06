"use client";
import { courseColorStyle } from "@/lib/domain/course-colors";
import Link from "next/link";
import { ScheduleManager } from "@/components/schedules/schedule-manager";
import { useState } from "react";
import { Button, Surface } from "@/components/ui/primitives";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { ActionForm } from "@/components/forms/action-form";
import { saveCourse, deleteAcademic } from "@/lib/actions/academic";
import { colors } from "@/lib/domain/calendar";
import { ColorPicker } from "@/components/ui/color-picker";
import type {
  Course,
  CourseSchedule,
  Semester,
} from "@/lib/supabase/database.types";
export function CourseManager({
  courses,
  semester,
  schedules,
  zone,
}: {
  courses: Course[];
  schedules: CourseSchedule[];
  zone: string;
  semester: Semester;
}) {
  const [editing, setEditing] = useState<Partial<Course> | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const writable = !semester.archived_at;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{semester.name}</p>
          <h1>Courses</h1>
          <p className="page-subtitle">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </p>
        </div>
        {writable && (
          <Button
            variant="primary"
            onClick={() => setEditing({ id: crypto.randomUUID(), revision: 0 })}
          >
            Add course
          </Button>
        )}
      </div>
      <Surface className="course-list">
        {!courses.length ? (
          <div className="empty-state">
            <h2>No courses yet</h2>
            <p>
              {writable
                ? "Add your first course for this semester."
                : "No courses were added to this semester."}
            </p>
          </div>
        ) : (
          courses.map((course) => (
            <div key={course.id} className="course-entry">
              <div className="course-row">
                <span
                  className="course-swatch"
                  style={courseColorStyle(course.color)}
                />
                <div>
                  <span className="eyebrow">{course.code}</span>
                  <h2>{course.name}</h2>
                  <Link
                    href={`/grades?course=${course.id}`}
                    className="field-help"
                  >
                    Grades
                  </Link>
                  {course.instructor && <p>{course.instructor}</p>}
                </div>
                {writable && (
                  <div className="course-actions">
                    <Button
                      onClick={() => setEditing(course)}
                      aria-label={`Edit ${course.code}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setDeleting(course)}
                      aria-label={`Delete ${course.code}`}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              <ScheduleManager
                course={course}
                semester={semester}
                zone={zone}
                schedules={schedules.filter((s) => s.course_id === course.id)}
              />
            </div>
          ))
        )}
      </Surface>
      {editing && (
        <EditorDialog
          title={editing.revision ? "Edit course" : "Add course"}
          onClose={() => setEditing(null)}
        >
          <ActionForm
            action={saveCourse}
            successMessage={
              editing.revision ? "Course updated" : "Course added"
            }
            revision={editing.revision}
            submitLabel="Save course"
            onSuccess={() => {
              setEditing(null);
            }}
          >
            <input type="hidden" name="id" value={editing.id} />
            <input type="hidden" name="semester_id" value={semester.id} />
            <label>
              Course code
              <input
                name="code"
                required
                maxLength={30}
                defaultValue={editing.code}
              />
            </label>
            <label>
              Course name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editing.name}
              />
            </label>
            <label>
              Instructor (optional)
              <input
                name="instructor"
                maxLength={120}
                defaultValue={editing.instructor}
              />
            </label>
            <ColorPicker
              label="Course color"
              defaultValue={editing.color ?? colors[0]}
            />
          </ActionForm>
        </EditorDialog>
      )}
      {deleting && (
        <EditorDialog
          title={`Delete ${deleting.code}?`}
          onClose={() => setDeleting(null)}
        >
          <p>
            This permanently deletes {deleting.name}. All linked calendar events
            will remain, with their current colors, without a course link.
            Recurring meetings, individual changes and tasks will also be
            preserved. Tasks and notes will become unassigned; their content is
            preserved. Courses with assessments cannot be deleted; archive the
            semester to preserve grade history.
          </p>
          <ActionForm
            action={deleteAcademic}
            successMessage="Course deleted"
            successDetail={deleting.code}
            submitLabel="Delete course"
            onSuccess={() => {
              setDeleting(null);
            }}
          >
            <input type="hidden" name="id" value={deleting.id} />
            <input type="hidden" name="semester_id" value={semester.id} />
            <input type="hidden" name="revision" value={deleting.revision} />
            <input type="hidden" name="kind" value="course" />
          </ActionForm>
        </EditorDialog>
      )}
    </>
  );
}
