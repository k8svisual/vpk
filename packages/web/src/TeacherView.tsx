import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FilePlus2, GraduationCap, Loader2, Save } from 'lucide-react';

/**
 * Teacher tools — create/edit lesson `.md` files directly (redesign/training-course.md's authoring loop:
 * "editing a lesson's content on disk is picked up on the very next request", now reachable from the UI
 * instead of only a text editor on disk). A plain textarea over the raw markdown, not a rich/structured
 * editor or live preview — the lesson format is just markdown + YAML frontmatter + typed fences, and a
 * structured editor is a real follow-up project, not a one-file addition; the server-side save endpoint
 * already validates by parsing before writing (see content.ts's saveLessonSource), so a malformed edit is
 * rejected with a clear error rather than silently corrupting a working lesson.
 */

interface LessonSummary {
  id: string;
  title: string;
  path: string;
}

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;

const NEW_LESSON_TEMPLATE = `---
id: my-new-lesson
title: My New Lesson
difficulty: 1
estimatedMinutes: 20
---

Write the lesson's introduction here.

## First task

Describe what the student should do.
`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

export function TeacherView() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');

  function refreshList() {
    getJson<{ lessons: LessonSummary[] }>('/course/lessons')
      .then((d) => setLessons(d.lessons))
      .catch((e: unknown) => setListError(String(e instanceof Error ? e.message : e)));
  }

  useEffect(refreshList, []);

  function openLesson(path: string) {
    setSelectedPath(path);
    setSaveResult(null);
    setLoadingSource(true);
    getJson<{ source: string }>(`/course/lesson/source?path=${encodeURIComponent(path)}`)
      .then((d) => setSource(d.source))
      .catch((e: unknown) => setSaveResult({ ok: false, message: String(e instanceof Error ? e.message : e) }))
      .finally(() => setLoadingSource(false));
  }

  function startNewLesson() {
    setCreating(true);
    setNewPath('course05/00-new-lesson.md');
  }

  function confirmNewLesson() {
    if (!newPath.trim()) return;
    setSelectedPath(newPath.trim());
    setSource(NEW_LESSON_TEMPLATE);
    setSaveResult(null);
    setCreating(false);
  }

  async function save() {
    if (!selectedPath) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/course/lesson/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, source }),
      });
      const json = (await res.json()) as { frontmatter?: { id: string; title: string } } | { error: string };
      if ('error' in json) {
        setSaveResult({ ok: false, message: json.error });
      } else {
        setSaveResult({ ok: true, message: `Saved "${json.frontmatter?.title}" (id: ${json.frontmatter?.id}).` });
        refreshList();
      }
    } catch (e: unknown) {
      setSaveResult({ ok: false, message: String(e instanceof Error ? e.message : e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="w-64 shrink-0 border rounded flex flex-col overflow-hidden" style={panelStyle}>
        <div className="px-3 py-2 border-b flex items-center justify-between gap-1.5 text-xs font-medium" style={panelStyle}>
          <span className="flex items-center gap-1.5">
            <GraduationCap size={13} />
            Courses
          </span>
          <button onClick={startNewLesson} title="New course" aria-label="New course" className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border cursor-pointer" style={panelStyle}>
            <FilePlus2 size={12} />
            New
          </button>
        </div>
        {listError && (
          <p className="text-xs p-3" style={errorStyle}>
            {listError}
          </p>
        )}
        <div className="flex-1 overflow-auto">
          {lessons?.map((l) => (
            <button
              key={l.path}
              onClick={() => openLesson(l.path)}
              className="block w-full text-left px-3 py-2 text-xs border-b cursor-pointer"
              style={{ borderColor: 'var(--vpk-border)', background: selectedPath === l.path ? 'var(--vpk-surface)' : undefined }}
            >
              <div className="font-medium">{l.title}</div>
              <div style={mutedStyle}>{l.path}</div>
            </button>
          ))}
          {lessons && lessons.length === 0 && (
            <p className="text-xs p-3" style={mutedStyle}>
              No courses yet — use New to create one.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col border rounded overflow-hidden" style={panelStyle}>
        {creating ? (
          <div className="p-3 space-y-2 text-xs">
            <label className="flex flex-col gap-1">
              <span style={mutedStyle}>New course path (relative to courses/, must end in .md)</span>
              <input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                className="px-2 py-1 rounded border font-mono"
                style={{ ...panelStyle, background: 'var(--vpk-surface)' }}
              />
            </label>
            <div className="flex gap-2">
              <button onClick={confirmNewLesson} className="px-2 py-1 rounded border cursor-pointer" style={panelStyle}>
                Create
              </button>
              <button onClick={() => setCreating(false)} className="px-2 py-1 rounded border cursor-pointer" style={panelStyle}>
                Cancel
              </button>
            </div>
          </div>
        ) : !selectedPath ? (
          <p className="text-sm p-3" style={mutedStyle}>
            Select a course on the left to edit it, or New to create one.
          </p>
        ) : (
          <>
            <div className="px-3 py-2 border-b flex items-center justify-between gap-2 text-xs" style={panelStyle}>
              <span className="font-mono">{selectedPath}</span>
              <button
                onClick={() => void save()}
                disabled={saving || loadingSource}
                className="flex items-center gap-1 px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed"
                style={panelStyle}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>
            {saveResult && (
              <div className="px-3 py-1.5 text-xs flex items-center gap-1.5 border-b" style={{ ...panelStyle, ...(saveResult.ok ? { color: 'var(--vpk-status-ok)' } : errorStyle) }}>
                {saveResult.ok ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
                {saveResult.message}
              </div>
            )}
            {loadingSource ? (
              <p className="text-sm p-3 flex items-center gap-1.5" style={mutedStyle}>
                <Loader2 size={14} className="animate-spin" /> Loading…
              </p>
            ) : (
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-3 text-xs font-mono resize-none outline-none"
                style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
