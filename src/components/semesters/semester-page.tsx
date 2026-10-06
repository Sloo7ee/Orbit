import { randomUUID } from "node:crypto";
import { loadWorkspace } from "@/lib/data";
import { dateLabel } from "@/lib/domain/semester";
import { CreateSemester, SemesterActions } from "./semester-controls";
import { SemesterProgress } from "./progress";
import { Surface, Badge } from "@/components/ui/primitives";
export async function SemesterPage() {
  const { semesters, selected, profile } = await loadWorkspace();
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Semesters</h1>
          <p className="page-subtitle">
            Manage your current semester and revisit previous ones.
          </p>
        </div>
      </div>
      <div className="semester-layout">
        <div className="semester-lists">
          {[false, true].map((archived) => {
            const items = semesters.filter((s) => !!s.archived_at === archived);
            return (
              <section
                key={String(archived)}
                aria-label={archived ? "Semester history" : "Active semesters"}
              >
                <h2 className="section-title">
                  {archived ? "History" : "Active semesters"}
                  <span>{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <div className="list-empty">
                    {archived
                      ? "Archived semesters will appear here."
                      : "No active semester yet. Create one to get started."}
                  </div>
                ) : (
                  items.map((semester) => (
                    <Surface
                      key={`${semester.id}-${semester.revision}`}
                      className="semester-item"
                    >
                      <div className="semester-item-heading">
                        <h3>{semester.name}</h3>
                        {selected?.id === semester.id && (
                          <Badge>Selected</Badge>
                        )}
                        {archived && <Badge>Archived</Badge>}
                      </div>
                      <p className="semester-dates">
                        {dateLabel(semester.start_date)} –{" "}
                        {dateLabel(semester.end_date)}
                      </p>
                      <SemesterProgress
                        semester={semester}
                        timezone={profile.timezone}
                      />
                      <SemesterActions
                        semester={semester}
                        selected={selected?.id === semester.id}
                      />
                    </Surface>
                  ))
                )}
              </section>
            );
          })}
        </div>
        <Surface className="semester-create">
          <h2>New semester</h2>
          <CreateSemester
            key={semesters.length}
            requestId={randomUUID()}
            zone={profile.timezone}
          />
        </Surface>
      </div>
    </div>
  );
}
