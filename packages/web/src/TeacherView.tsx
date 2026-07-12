import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, FilePlus2, GraduationCap, HelpCircle, Loader2, Save, ShieldCheck, X } from 'lucide-react';
import { CourseResourcesPanel } from './CourseResourcesPanel';

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

interface ValidationResult {
  frontmatter: { id: string; title: string };
  counts: Record<'prose' | 'detect' | 'setup' | 'check' | 'teardown' | 'quiz' | 'task', number>;
  warnings: string[];
}

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;
const okStyle = { color: 'var(--vpk-status-ok)' } as const;

const NEW_LESSON_TEMPLATE = `---
id: my-new-lesson
title: My New Lesson
description: One or two sentences shown on the Catalog card — what the student will learn.
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

/** Resources are per-course, not per-lesson-file — derived from the lesson path's first segment
 *  (course02/00-using-oc.md -> "course02"), the same identity server-side resources.ts groups by. */
function courseOfPath(path: string): string {
  const slash = path.indexOf('/');
  return slash >= 0 ? path.slice(0, slash) : path;
}

export function TeacherView() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ ok: true; result: ValidationResult } | { ok: false; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'content' | 'resources'>('content');

  function refreshList() {
    getJson<{ lessons: LessonSummary[] }>('/course/lessons')
      .then((d) => setLessons(d.lessons))
      .catch((e: unknown) => setListError(String(e instanceof Error ? e.message : e)));
  }

  useEffect(refreshList, []);

  function openLesson(path: string) {
    setSelectedPath(path);
    setSaveResult(null);
    setValidation(null);
    setEditorTab('content');
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
    const path = newPath.trim();
    if (!path) return;
    setSelectedPath(path);
    setSource(NEW_LESSON_TEMPLATE);
    setSaveResult(null);
    setValidation(null);
    setEditorTab('content');
    setCreating(false);
    // Best-effort — a resources directory that isn't configured yet (Settings > Education) shouldn't block
    // creating the lesson itself; the Resources tab surfaces that same "not configured" state on its own.
    void fetch('/course/resources/ensure-dir', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ course: courseOfPath(path) }),
    }).catch(() => undefined);
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

  async function validate() {
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch('/course/lesson/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const json = (await res.json()) as ValidationResult | { error: string };
      if ('error' in json) setValidation({ ok: false, message: json.error });
      else setValidation({ ok: true, result: json });
    } catch (e: unknown) {
      setValidation({ ok: false, message: String(e instanceof Error ? e.message : e) });
    } finally {
      setValidating(false);
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHelpOpen((o) => !o)}
                  title="Field & syntax reference"
                  className="flex items-center gap-1 px-2 py-1 rounded border cursor-pointer"
                  style={{ ...panelStyle, background: helpOpen ? 'var(--vpk-surface)' : undefined }}
                >
                  <HelpCircle size={12} />
                  Reference
                </button>
                <button
                  onClick={() => void validate()}
                  disabled={validating || loadingSource}
                  className="flex items-center gap-1 px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed"
                  style={panelStyle}
                >
                  {validating ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  Validate
                </button>
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
            </div>
            {saveResult && (
              <div className="px-3 py-1.5 text-xs flex items-center gap-1.5 border-b" style={{ ...panelStyle, ...(saveResult.ok ? okStyle : errorStyle) }}>
                {saveResult.ok ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
                {saveResult.message}
              </div>
            )}
            {validation && <ValidationBanner validation={validation} />}

            <div className="px-3 pt-2 flex items-center gap-1 border-b" style={panelStyle}>
              {(['content', 'resources'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setEditorTab(t)}
                  className="px-2 py-1 text-xs rounded-t border border-b-0 cursor-pointer capitalize"
                  style={{
                    borderColor: 'var(--vpk-border)',
                    background: editorTab === t ? 'var(--vpk-bg)' : undefined,
                    color: editorTab === t ? 'var(--vpk-fg)' : 'var(--vpk-fg-muted)',
                    marginBottom: -1,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {loadingSource ? (
              <p className="text-sm p-3 flex items-center gap-1.5" style={mutedStyle}>
                <Loader2 size={14} className="animate-spin" /> Loading…
              </p>
            ) : editorTab === 'content' ? (
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-3 text-xs font-mono resize-none outline-none"
                style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              />
            ) : (
              <CourseResourcesPanel course={courseOfPath(selectedPath)} />
            )}
          </>
        )}
      </div>

      {helpOpen && <ReferencePanel onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function ValidationBanner({ validation }: { validation: { ok: true; result: ValidationResult } | { ok: false; message: string } }) {
  if (!validation.ok) {
    return (
      <div className="px-3 py-2 text-xs border-b flex items-start gap-1.5" style={{ ...panelStyle, ...errorStyle }}>
        <CircleAlert size={13} className="shrink-0 mt-0.5" />
        <span>{validation.message}</span>
      </div>
    );
  }
  const { counts, warnings } = validation.result;
  const countLine = `${counts.prose} prose, ${counts.detect} detect, ${counts.setup} setup, ${counts.check} check, ${counts.teardown} teardown, ${counts.quiz} quiz, ${counts.task} task`;
  return (
    <div className="px-3 py-2 text-xs border-b space-y-1" style={panelStyle}>
      <div className="flex items-center gap-1.5" style={warnings.length === 0 ? okStyle : undefined}>
        {warnings.length === 0 ? <CheckCircle2 size={13} /> : <CircleAlert size={13} style={{ color: 'var(--vpk-status-warn, #b58900)' }} />}
        <span>
          Parses OK — {countLine}. {warnings.length === 0 ? 'No warnings.' : `${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`}
        </span>
      </div>
      {warnings.length > 0 && (
        <ul className="list-disc pl-5 space-y-0.5" style={mutedStyle}>
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Slide-out field/syntax reference — static content, no server round-trip. Mirrors the actual fields
 *  @vpk/training's LessonFrontmatter/Check types accept (see lesson.ts/types.ts) and the fence/details
 *  conventions every authored course in courses/ already uses, so this is documentation of the real format,
 *  not aspirational. */
function ReferencePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-96 shrink-0 border rounded overflow-hidden flex flex-col" style={panelStyle}>
      <div className="px-3 py-2 border-b flex items-center justify-between text-xs font-medium" style={panelStyle}>
        <span className="flex items-center gap-1.5">
          <HelpCircle size={13} />
          Field &amp; Syntax Reference
        </span>
        <button onClick={onClose} aria-label="Close reference" className="cursor-pointer">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 text-xs space-y-4">
        <RefSection title="Frontmatter (required)">
          <RefField name="id" desc="Unique lesson id, e.g. course05-01-intro." />
          <RefField name="title" desc="Shown in the Catalog and Course header." />
        </RefSection>
        <RefSection title="Frontmatter (optional)">
          <RefField name="description" desc="Short blurb (1–2 sentences) shown on the Catalog card under the title." />
          <RefField name="difficulty" desc="Number, shown next to the title." />
          <RefField name="estimatedMinutes" desc="Whole-course time budget — drives the header's countdown clock." />
          <RefField name="showCountdown" desc="false hides the ticking clock while keeping estimatedMinutes for planning. Defaults to true." />
          <RefField name="prereqs" desc="List of other lesson ids, e.g. [getting-started-00-cluster]." />
          <RefField name="allow" desc="List of verbs the terminal permits, e.g. [get, describe, create, delete]." />
          <RefField name="confirmDelete" desc="false skips the terminal's 'confirm before running a delete' prompt — set it for delete-heavy courses. Defaults to true." />
          <RefField name="graphic" desc="schematic shows a live, isolated visualization of the student's own cluster below the terminal (a Pod's schematic). Omitted = no panel." />
          <RefField name="cli" desc="Which CLI this lesson targets, e.g. [oc]. Defaults to kubectl if omitted." />
          <RefField name="passWhen" desc='"functional" or "conformant" — what counts as passing a check.' />
          <RefField name="floor" desc='"loose" | "standard" | "strict" | "pinned" — minimum strictness.' />
          <RefField name="timeoutMs / pollMs" desc="For checks that need to poll (e.g. waiting on minikube start)." />
          <RefField name="colors" desc="page/question/code/answer — optional CSS colors for this lesson's look." />
        </RefSection>
        <RefSection title="Body: prose">
          <p style={mutedStyle}>Plain markdown — headings, paragraphs, lists, `code`, fenced code blocks.</p>
        </RefSection>
        <RefSection title="Hint / Step-by-step">
          <Code>{`<details><summary>Hint</summary>\n\nA nudge, not the full answer.\n\n</details>\n\n<details><summary>Step-by-step</summary>\n\n\`\`\`\nkubectl get pods\n\`\`\`\n\n</details>`}</Code>
        </RefSection>
        <RefSection title="vpk-check block">
          <p style={mutedStyle}>Fenced ```vpk-check block, one per gradeable task. Every kind needs id, describe, kind.</p>
          <RefField name="cluster" desc='assert: contextReachable | { nodesReady: N } | multiNode | { serverVersionAtLeast: "1.28" }' />
          <RefField name="inventory" desc="namespace + expect: { source: literal, value: { Deployment: 1 } }" />
          <RefField name="fields" desc="namespace + expect with paths — checks fields are PRESENT (not their value)." />
          <RefField name="value" desc="namespace + assert: [{ select, path, op: '==', value }] — checks an exact value." />
          <Code>{`\`\`\`vpk-check\nid: my-check\ndescribe: Deployment exists and is Ready\nkind: inventory\nnamespace: default\nexpect: { source: literal, value: { Deployment: 1 } }\n\`\`\``}</Code>
        </RefSection>
        <RefSection title="vpk-task block (Start/Complete lifecycle)">
          <p style={mutedStyle}>
            Fenced ```vpk-task block — a completable unit with its own Start/Complete buttons, additive
            alongside vpk-check (which keeps its single "Run check" button, no lifecycle). "manual" completion
            is self-attested by the student; "auto" arms background polling of an author-run command until it
            passes or gives up (see below).
          </p>
          <RefField name="id" desc="Unique within the lesson." />
          <RefField name="describe" desc="Shown as the card's title. Falls back to id if omitted." />
          <RefField name="completion" desc='"manual" (Start + self-attested Complete) or "auto" (Start arms polling).' />
          <RefField name="estimatedMinutes" desc='Required for "auto" — polling gives up after estimatedMinutes × 1.25, then the student re-checks from the Progress modal. Unused for "manual".' />
          <RefField
            name="check"
            desc="verb + args (argv after the CLI) + expect: { path?, op, value }. Runs SERVER-SIDE, not typed by the student — still gated by this lesson's own allow list, PLUS a separate student-granted approval (per course or for all courses) before the server will ever auto-run it. path resolves into the command's stdout parsed as JSON (dotted, [*] wildcards supported, same convention as vpk-check's fields kind); omit path to compare the whole value. op is ==, >=, <=, matches (regex), or contains (substring, for non-JSON stdout)."
          />
          <Code>{`\`\`\`vpk-task\nid: deploy-ready\ndescribe: Deployment rolled out\ncompletion: auto\nestimatedMinutes: 5\ncheck:\n  verb: get\n  args: [deployment, my-app, -n, default, -o, json]\n  expect:\n    path: .status.readyReplicas\n    op: '=='\n    value: 1\n\`\`\``}</Code>
        </RefSection>
        <RefSection title="Other fences (authored, not yet automated)">
          <RefField name="vpk-detect" desc="Environment probe shown as a card (context, provisioner, nodes)." />
          <RefField name="vpk-setup / vpk-teardown / vpk-quiz" desc="Parsed and shown as a placeholder card — not yet run automatically." />
        </RefSection>
      </div>
    </div>
  );
}

function RefSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function RefField({ name, desc }: { name: string; desc: string }) {
  return (
    <div>
      <code className="font-mono" style={{ background: 'var(--vpk-surface)', border: '1px solid var(--vpk-border)', borderRadius: 3, padding: '0 4px' }}>
        {name}
      </code>{' '}
      <span style={mutedStyle}>{desc}</span>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="font-mono whitespace-pre-wrap p-2 rounded border overflow-auto" style={{ ...panelStyle, background: 'var(--vpk-bg)' }}>
      {children}
    </pre>
  );
}
