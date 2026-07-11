import { useEffect, useState } from 'react';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';

/**
 * Course Catalog — the picker for Training Course mode (redesign/training-course.md §13's `GET
 * /course/lessons`, previously unconsumed by any UI). Lists every lesson the server can find under
 * `courses/`, grouped by their file's parent directory (a reasonable stand-in for "course" grouping until
 * §15's real catalog manifest exists — see content.ts's own doc comment on why that's still a later slice).
 * Selecting a card hands the lesson id up to App.tsx, which switches to the Course view with it.
 */

interface LessonSummary {
  id: string;
  title: string;
  difficulty?: number;
  estimatedMinutes?: number;
  path: string;
}

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;

function groupTitle(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? (parts[0] ?? 'Courses') : 'Courses';
}

export function CourseCatalogView({ onSelect }: { onSelect: (lessonId: string) => void }) {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/course/lessons')
      .then((r) => r.json())
      .then((d: { lessons?: LessonSummary[]; error?: string }) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setLessons(d.lessons ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm" style={errorStyle}>
        {error}
      </p>
    );
  }
  if (!lessons) {
    return (
      <p className="text-sm" style={mutedStyle}>
        Loading catalog…
      </p>
    );
  }
  if (lessons.length === 0) {
    return (
      <p className="text-sm" style={mutedStyle}>
        No courses found under the courses/ directory.
      </p>
    );
  }

  const groups = new Map<string, LessonSummary[]>();
  for (const lesson of lessons) {
    const g = groupTitle(lesson.path);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)?.push(lesson);
  }

  return (
    <div className="max-w-3xl space-y-6 pb-8">
      <header>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <BookOpen size={16} />
          Course Catalog
        </h2>
        <p className="text-xs mt-1" style={mutedStyle}>
          Pick a course to start it in the Course view.
        </p>
      </header>
      {[...groups.entries()].map(([group, entries]) => (
        <div key={group} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={mutedStyle}>
            {group}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entries.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onSelect(lesson.id)}
                className="text-left border rounded p-3 cursor-pointer hover:brightness-95"
                style={panelStyle}
              >
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <GraduationCap size={14} />
                  {lesson.title}
                </div>
                <div className="text-xs mt-1 flex gap-3" style={mutedStyle}>
                  {lesson.difficulty !== undefined && <span>Difficulty {lesson.difficulty}</span>}
                  {lesson.estimatedMinutes !== undefined && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />~{lesson.estimatedMinutes} min
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
