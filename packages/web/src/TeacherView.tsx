import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FilePlus2, GraduationCap, HelpCircle, Loader2, Save, ShieldCheck, X } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { CourseResourcesPanel } from './CourseResourcesPanel';
import { renderLessonHtml } from './lessonMarkdown';
import { BlockCard, TONE_ENV, TONE_IDLE, TONE_OK, TONE_TASK, type CardTone } from './LessonRunnerView';
import { editorThemeFor } from './DefinitionModal';
import type { Theme } from './theme';

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

/** Local wire-shape types (thin-client convention — @vpk/web never imports @vpk/core or @vpk/training; see
 *  LessonRunnerView.tsx's own header comment). Mirrors @vpk/training's LessonBlockKind/LessonBlock/
 *  LessonSegment exactly — just enough shape for the Preview tab to walk validateLessonSource's `segments`. */
type LessonBlockKind = 'detect' | 'setup' | 'check' | 'teardown' | 'quiz' | 'task';
interface LessonBlock {
  kind: LessonBlockKind;
  data: unknown;
}
type LessonSegment = { type: 'prose'; markdown: string } | { type: 'block'; block: LessonBlock };

interface ValidationResult {
  frontmatter: {
    id: string;
    title: string;
    estimatedMinutes?: number;
    showCountdown?: boolean;
    confirmDelete?: boolean;
    clusterViews?: ('cluster3d' | 'schematic')[];
    provisioning?: boolean;
    cli?: string[];
    passWhen?: 'functional' | 'conformant';
    floor?: 'loose' | 'standard' | 'strict' | 'pinned';
    allow?: string[];
    prereqs?: string[];
    timeMode?: 'advisory' | 'graded' | 'exam';
  };
  counts: Record<'prose' | 'detect' | 'setup' | 'check' | 'teardown' | 'quiz' | 'task', number>;
  warnings: string[];
  segments: LessonSegment[];
}

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;
const okStyle = { color: 'var(--vpk-status-ok)' } as const;

/** A comprehensive starter, not a lesson to ship as-is — every frontmatter field and every block kind appears
 *  once with a real example value, so a fresh lesson starts at zero "missing" Validate warnings (see
 *  content.ts's validateLessonSource) and an author discovers the whole format by TRIMMING what they don't
 *  need rather than looking it up in Reference. `colors` is the one field left commented out: it's purely
 *  cosmetic, unrelated to any Validate warning, and forcing custom colors onto every new lesson by default is
 *  a worse starting point than the app's own theme. */
const NEW_LESSON_TEMPLATE = `---
id: my-new-lesson-CHANGE-ME
title: My New Lesson
description: One or two sentences shown on the Catalog card — what the student will learn.
difficulty: 1
estimatedMinutes: 20
showCountdown: true
prereqs: []
allow: [get]
confirmDelete: true
clusterViews: [cluster3d, schematic]
cli: [kubectl]
passWhen: functional
floor: standard
timeoutMs: 60000
pollMs: 5000
timeMode: advisory
sandbox: ""
answerKey: ""
provisioning: false
# colors:
#   page: "#fdf6e3"
#   question: "#333333"
#   code: "#002b36"
#   answer: "#fdf6e3"
---

This is a comprehensive starter — it shows every frontmatter field and one of every block kind. Trim what
this lesson doesn't need (most lessons use only a handful), don't ship it as-is.

Write the lesson's introduction here.

\`\`\`vpk-detect
tools: [kubectl, minikube, k3d, microk8s, docker-desktop]
\`\`\`

## First task

Describe what the student should do.

\`\`\`vpk-setup
note: Fixture/seed state this lesson expects to already exist — authored only, not yet automated.
\`\`\`

\`\`\`vpk-check
id: my-check
describe: One-line description of what this check confirms
kind: cluster
assert: contextReachable
\`\`\`

\`\`\`vpk-task
id: my-task
describe: Deployment rolled out
completion: auto
estimatedMinutes: 5
check:
  verb: get
  args: [deployment, my-app, -n, default, -o, json]
  expect:
    path: .status.readyReplicas
    op: '=='
    value: 1
\`\`\`

\`\`\`vpk-teardown
note: What to remove afterward — authored only, not yet automated.
\`\`\`

\`\`\`vpk-quiz
question: What does \`kubectl get pods\` do?
answer: Lists running Pods in the current namespace.
\`\`\`
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

export function TeacherView({
  initialPath,
  onOpened,
  theme,
}: {
  /** Set when this view was reached via an "Edit this lesson" shortcut (Catalog card / Course header) rather
   *  than the plain nav rail — opens straight to that lesson's Content tab on mount. */
  initialPath?: string;
  /** Called once `initialPath` has been opened, so App.tsx can clear its own copy — otherwise a LATER plain
   *  nav-rail visit to Teacher (this component remounts fresh every time) would silently reopen the same
   *  lesson instead of showing the normal "select a course" empty state. */
  onOpened?: () => void;
  /** Picks the matching CodeMirror editor theme for the Content tab (see DefinitionModal.tsx's editorThemeFor,
   *  reused here) — same reasoning as DefinitionModal's own `theme` prop: the app's color themes are a CSS-
   *  variable mechanism a syntax-highlighted editor can't just inherit via var(). */
  theme: Theme;
}) {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [source, setSource] = useState('');
  // Mirrors whatever was last loaded from disk or successfully saved — `source !== savedSource` is the
  // "unsaved changes" signal the discard-confirmation guards and the header's dirty indicator both key off.
  const [savedSource, setSavedSource] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ ok: true; result: ValidationResult } | { ok: false; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'content' | 'preview' | 'resources'>('content');

  function refreshList() {
    getJson<{ lessons: LessonSummary[] }>('/course/lessons')
      .then((d) => setLessons(d.lessons))
      .catch((e: unknown) => setListError(String(e instanceof Error ? e.message : e)));
  }

  useEffect(refreshList, []);

  // Whether the draft has edits the last load/save doesn't reflect — the single signal both discard-confirm
  // guards below and the header's "Unsaved changes" indicator key off.
  const dirty = source !== savedSource;

  /** Guards any action about to overwrite `source`/`selectedPath` out from under an unsaved edit — used by
   *  both openLesson and confirmNewLesson. Named for what it protects, not how (plain window.confirm, same
   *  convention CourseResourcesPanel's delete and DemoDataView's clear already use — no bespoke modal). */
  function confirmDiscardIfDirty(): boolean {
    if (!dirty) return true;
    return confirm(`Discard unsaved changes to "${selectedPath}"?`);
  }

  function openLesson(path: string) {
    if (!confirmDiscardIfDirty()) return;
    setSelectedPath(path);
    setSaveResult(null);
    setValidation(null);
    setEditorTab('content');
    setLoadingSource(true);
    getJson<{ source: string }>(`/course/lesson/source?path=${encodeURIComponent(path)}`)
      .then((d) => {
        setSource(d.source);
        setSavedSource(d.source);
      })
      .catch((e: unknown) => setSaveResult({ ok: false, message: String(e instanceof Error ? e.message : e) }))
      .finally(() => setLoadingSource(false));
  }

  // Opens the "Edit this lesson" shortcut's target on mount — a fresh mount happens every time this view is
  // entered (App.tsx conditionally renders <TeacherView/> only while view === 'teacher'), so mount-once here
  // is exactly "once per visit", not "once ever". `dirty` is trivially false at this point (source/savedSource
  // both start empty), so confirmDiscardIfDirty inside openLesson never prompts here.
  useEffect(() => {
    if (initialPath) {
      openLesson(initialPath);
      onOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNewLesson() {
    setCreating(true);
    setNewPath('course05/00-new-lesson.md');
  }

  function confirmNewLesson() {
    const path = newPath.trim();
    if (!path) return;
    if (!confirmDiscardIfDirty()) return;
    setSelectedPath(path);
    setSource(NEW_LESSON_TEMPLATE);
    setSavedSource(NEW_LESSON_TEMPLATE);
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
      // Optimistic-concurrency check — catches a change made outside THIS editor (another tab, an external
      // editor, a git pull) since this draft was loaded, which a plain overwrite would otherwise silently
      // discard. Reuses the existing source route rather than a new endpoint/response field. Best-effort only:
      // a brand-new never-saved lesson has nothing on disk to compare against yet, so a failed/404 pre-check
      // never blocks the save — only a successfully-fetched, actually-different on-disk version does.
      try {
        const onDisk = await getJson<{ source: string }>(`/course/lesson/source?path=${encodeURIComponent(selectedPath)}`);
        if (onDisk.source !== savedSource && !confirm('This file changed on disk since you opened it. Overwrite it with your version?')) {
          setSaving(false);
          return;
        }
      } catch {
        // Nothing on disk yet to conflict with (e.g. first save of a new lesson) — proceed.
      }
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
        setSavedSource(source);
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

  // Auto-refreshes the Preview tab as the draft changes, without requiring an explicit Validate click first —
  // debounced so fast typing doesn't fire a request per keystroke. The manual Validate button/banner above
  // keep working exactly as before; this reuses the SAME validate()/validation state rather than a parallel one.
  useEffect(() => {
    if (editorTab !== 'preview') return;
    const t = setTimeout(() => void validate(), 400);
    return () => clearTimeout(t);
    // Deliberately omits `validate` — a plain function recreated every render, not memoized; including it would
    // refire this effect on every render the call itself causes. `editorTab`/`source` are the only real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorTab, source]);

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
              <span className="flex items-center gap-2">
                <span className="font-mono">{selectedPath}</span>
                {dirty && (
                  <span style={{ color: 'var(--vpk-status-warn, #b58900)' }} title="Unsaved edits — Save to write them back to disk">
                    • Unsaved changes
                  </span>
                )}
              </span>
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
              {(['content', 'preview', 'resources'] as const).map((t) => (
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
              <div className="flex-1 min-h-0 overflow-auto">
                <CodeMirror
                  key={selectedPath}
                  value={source}
                  onChange={setSource}
                  height="100%"
                  theme={editorThemeFor(theme)}
                  extensions={[markdown()]}
                  basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: true }}
                />
              </div>
            ) : editorTab === 'preview' ? (
              <PreviewPane validation={validation} />
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

/** Shared structural-error readout — validateLessonSource throws (bad frontmatter, unclosed fence) rather
 *  than returning a warning, since there's no lesson to report counts/segments ABOUT. Used by both the
 *  Validate banner and the Preview tab so a parse error looks identical wherever it's surfaced. */
function ParseErrorNotice({ message, bordered = true }: { message: string; bordered?: boolean }) {
  return (
    <div className={`px-3 py-2 text-xs flex items-start gap-1.5 ${bordered ? 'border-b' : ''}`} style={{ ...panelStyle, ...errorStyle }}>
      <CircleAlert size={13} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function ValidationBanner({ validation }: { validation: { ok: true; result: ValidationResult } | { ok: false; message: string } }) {
  if (!validation.ok) return <ParseErrorNotice message={validation.message} />;
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

const BLOCK_KINDS = ['detect', 'setup', 'check', 'teardown', 'quiz', 'task'] as const;

/** The draft's rendered content + a "what this lesson turns on" checklist — the same parsed `segments`/
 *  `counts`/`frontmatter` the Validate banner already fetches (see the auto-refresh effect above), just shown
 *  as a read-out instead of a warnings list. Deliberately inert: no /course/env probe, no Start/Run buttons,
 *  no polling — a Preview shows what the lesson IS, not a live run of it. */
function PreviewPane({ validation }: { validation: { ok: true; result: ValidationResult } | { ok: false; message: string } | null }) {
  if (!validation) {
    return (
      <p className="text-sm p-3 flex items-center gap-1.5" style={mutedStyle}>
        <Loader2 size={14} className="animate-spin" /> Parsing…
      </p>
    );
  }
  if (!validation.ok) return <ParseErrorNotice message={validation.message} bordered={false} />;
  const { segments } = validation.result;
  return (
    <div className="flex-1 overflow-auto p-3 space-y-3">
      <FeatureChecklist result={validation.result} />
      <div className="space-y-3">
        {segments.map((seg, i) =>
          seg.type === 'prose' ? (
            <div key={i} className="lesson-prose" dangerouslySetInnerHTML={{ __html: renderLessonHtml(seg.markdown) }} />
          ) : (
            <PreviewBlockCard key={i} block={seg.block} />
          ),
        )}
      </div>
    </div>
  );
}

function FeatureChecklist({ result }: { result: ValidationResult }) {
  const fm = result.frontmatter;
  const countdownOn = fm.showCountdown !== false && fm.estimatedMinutes !== undefined;
  const confirmOn = fm.confirmDelete !== false;
  const clusterViewsOn = (fm.clusterViews?.length ?? 0) > 0;
  return (
    <div className="rounded border p-3" style={panelStyle}>
      <div className="text-xs font-semibold mb-2">What this lesson turns on</div>
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <FeatureRow
            label="Countdown clock"
            value={countdownOn ? 'On' : 'Off'}
            tone={countdownOn ? TONE_OK : TONE_IDLE}
            title={fm.estimatedMinutes === undefined ? 'No estimatedMinutes set' : fm.showCountdown === false ? 'showCountdown: false' : undefined}
          />
          <FeatureRow
            label="Delete-confirm prompt"
            value={confirmOn ? 'On' : 'Off'}
            tone={confirmOn ? TONE_OK : TONE_IDLE}
            title={confirmOn ? undefined : 'confirmDelete: false'}
          />
          <FeatureRow
            label="Cluster-view launchers"
            value={clusterViewsOn ? fm.clusterViews!.join(', ') : 'Off'}
            tone={clusterViewsOn ? TONE_OK : TONE_IDLE}
          />
          <FeatureRow label="Provisioning mode" value={fm.provisioning ? 'On' : 'Off'} tone={fm.provisioning ? TONE_TASK : TONE_IDLE} />
          <FeatureRow label="CLI target" value={fm.cli?.length ? fm.cli.join(', ') : 'kubectl (default)'} tone={TONE_IDLE} />
        </div>
        <div>
          <FeatureRow label="Pass criteria" value={fm.passWhen ?? 'not set'} tone={TONE_IDLE} />
          <FeatureRow label="Permission floor" value={fm.floor ?? 'not set'} tone={TONE_IDLE} />
          <FeatureRow label="Allowed verbs" value={fm.allow?.length ? fm.allow.join(', ') : 'not set'} tone={TONE_IDLE} />
          <FeatureRow label="Prerequisites" value={fm.prereqs?.length ? fm.prereqs.join(', ') : 'None'} tone={TONE_IDLE} />
          <FeatureRow label="Time mode" value={fm.timeMode ?? 'not set'} tone={TONE_IDLE} />
        </div>
      </div>
      <div className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-1.5" style={panelStyle}>
        {BLOCK_KINDS.map((k) => (
          <CountChip key={k} label={k} count={result.counts[k]} />
        ))}
      </div>
    </div>
  );
}

function FeatureRow({ label, value, tone, title }: { label: string; value: string; tone: CardTone; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs" title={title}>
      <span style={mutedStyle}>{label}</span>
      <span className="rounded-full px-2 py-0.5 font-medium text-right" style={{ color: tone.base, background: tone.soft }}>
        {value}
      </span>
    </div>
  );
}

function CountChip({ label, count }: { label: string; count: number }) {
  const tone = count > 0 ? TONE_OK : TONE_IDLE;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ color: tone.base, background: tone.soft }}>
      {label}: {count}
    </span>
  );
}

/** One authored block's fields, read-only and never executed (see PreviewPane's own doc comment) — mirrors
 *  LessonRunnerView's real BlockCard tones per kind so a Preview card looks like what the student will
 *  eventually see, just inert. */
function PreviewBlockCard({ block }: { block: LessonBlock }) {
  const d = (block.data ?? {}) as Record<string, unknown>;
  if (block.kind === 'detect') {
    return (
      <BlockCard chip="Environment" tone={TONE_ENV} title="Detected environment" pill="Not run in Preview" pillTone={TONE_IDLE}>
        <PreBody>{summarizeBlockData(block.data)}</PreBody>
      </BlockCard>
    );
  }
  if (block.kind === 'check') {
    return (
      <BlockCard chip="Check" tone={TONE_OK} title={String(d.describe ?? d.id ?? 'Check')} pill="Not run in Preview" pillTone={TONE_IDLE}>
        <PreBody>{`id: ${String(d.id ?? '—')}\nkind: ${String(d.kind ?? '—')}`}</PreBody>
      </BlockCard>
    );
  }
  if (block.kind === 'task') {
    const autoLine = d.completion === 'auto' && d.estimatedMinutes !== undefined ? `\nestimatedMinutes: ${String(d.estimatedMinutes)}` : '';
    return (
      <BlockCard chip="Task" tone={TONE_TASK} title={String(d.describe ?? d.id ?? 'Task')} pill="Not run in Preview" pillTone={TONE_IDLE}>
        <PreBody>{`completion: ${String(d.completion ?? '—')}${autoLine}`}</PreBody>
      </BlockCard>
    );
  }
  const label = block.kind === 'setup' ? 'Setup' : block.kind === 'teardown' ? 'Teardown' : 'Quiz';
  return (
    <BlockCard chip={label} tone={TONE_IDLE} title={`${label} (authored only, not yet automated)`}>
      <PreBody>{summarizeBlockData(block.data)}</PreBody>
    </BlockCard>
  );
}

function PreBody({ children }: { children: string }) {
  return <div style={{ whiteSpace: 'pre-wrap' }}>{children}</div>;
}

/** A schema-less block's YAML has no fixed shape (see lesson.ts's own doc comment — this module never
 *  validates vpk-detect/setup/teardown/quiz content), so this is a best-effort one-line-per-key readout
 *  rather than pretending to understand the structure. */
function summarizeBlockData(data: unknown): string {
  if (data === undefined || data === null) return '(empty)';
  if (typeof data !== 'object') return String(data);
  return Object.entries(data as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`)
    .join('\n');
}

/** Slide-out field/syntax reference — static content, no server round-trip. Mirrors the actual fields
 *  @vpk/training's LessonFrontmatter/Check types accept (see lesson.ts/types.ts) and the fence/details
 *  conventions every authored course in courses/ already uses, so this is documentation of the real format,
 *  not aspirational. Each section is a `BlockCard` — the SAME stripe/chip shell Preview and the real Course
 *  view use for lesson blocks — colored by what that content actually renders as elsewhere in the app, so an
 *  author already recognizes "green means check, amber means task" by the time they open this panel. */
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
      <div className="flex-1 overflow-auto p-3 text-xs space-y-3">
        <BlockCard chip="Required" tone={TONE_ENV} title="Frontmatter">
          <RefField name="id" desc="Unique lesson id, e.g. course05-01-intro." tone={TONE_ENV} first />
          <RefField name="title" desc="Shown in the Catalog and Course header." tone={TONE_ENV} />
        </BlockCard>
        <BlockCard chip="Optional" tone={TONE_IDLE} title="Frontmatter">
          <RefField name="description" desc="Short blurb (1–2 sentences) shown on the Catalog card under the title." tone={TONE_IDLE} first />
          <RefField name="difficulty" desc="Number, shown next to the title." tone={TONE_IDLE} />
          <RefField name="estimatedMinutes" desc="Whole-course time budget — drives the header's countdown clock." tone={TONE_IDLE} />
          <RefField name="showCountdown" desc="false hides the ticking clock while keeping estimatedMinutes for planning. Defaults to true." tone={TONE_IDLE} />
          <RefField name="prereqs" desc="List of other lesson ids, e.g. [getting-started-00-cluster]." tone={TONE_IDLE} />
          <RefField name="allow" desc="List of verbs the terminal permits, e.g. [get, describe, create, delete]." tone={TONE_IDLE} />
          <RefField name="confirmDelete" desc="false skips the terminal's 'confirm before running a delete' prompt — set it for delete-heavy courses. Defaults to true." tone={TONE_IDLE} />
          <RefField name="clusterViews" desc="List of live-cluster views offered as pop-out launcher chips below the terminal — each opens the REAL interactive view of the student's own cluster (from an isolated capture) in its own window. Values: cluster3d, schematic. e.g. [cluster3d, schematic]. Omitted = no launcher." tone={TONE_IDLE} />
          <RefField name="cli" desc="Which CLI this lesson targets, e.g. [oc]. Defaults to kubectl if omitted." tone={TONE_IDLE} />
          <RefField name="passWhen" desc='"functional" or "conformant" — what counts as passing a check.' tone={TONE_IDLE} />
          <RefField name="floor" desc='"loose" | "standard" | "strict" | "pinned" — minimum strictness.' tone={TONE_IDLE} />
          <RefField name="timeoutMs / pollMs" desc="For checks that need to poll (e.g. waiting on minikube start)." tone={TONE_IDLE} />
          <RefField name="timeMode" desc={'"advisory" | "graded" | "exam" — how strictly this lesson\'s timing counts.'} tone={TONE_IDLE} />
          <RefField name="provisioning" desc="true for a lesson before any student namespace exists yet (sandbox is meaningless here)." tone={TONE_IDLE} />
          <RefField name="sandbox" desc="The student's dedicated namespace for this lesson, if it has one." tone={TONE_IDLE} />
          <RefField name="answerKey" desc="Id of a companion answer-key lesson/reference, if this lesson has one." tone={TONE_IDLE} />
          <RefField name="colors" desc="page/question/code/answer — optional CSS colors for this lesson's look." tone={TONE_IDLE} />
        </BlockCard>
        <BlockCard chip="Prose" tone={TONE_IDLE} title="Body">
          <p style={{ ...mutedStyle, lineHeight: 1.5 }}>Plain markdown — headings, paragraphs, lists, `code`, fenced code blocks.</p>
        </BlockCard>
        <BlockCard chip="Details" tone={TONE_IDLE} title="Hint / Step-by-step">
          <Code tone={TONE_IDLE}>{`<details><summary>Hint</summary>\n\nA nudge, not the full answer.\n\n</details>\n\n<details><summary>Step-by-step</summary>\n\n\`\`\`\nkubectl get pods\n\`\`\`\n\n</details>`}</Code>
        </BlockCard>
        <BlockCard chip="Check" tone={TONE_OK} title="vpk-check block">
          <p style={{ ...mutedStyle, lineHeight: 1.5 }}>Fenced ```vpk-check block, one per gradeable task. Every kind needs id, describe, kind.</p>
          <RefField name="cluster" desc='assert: contextReachable | { nodesReady: N } | multiNode | { serverVersionAtLeast: "1.28" }' tone={TONE_OK} />
          <RefField name="inventory" desc="namespace + expect: { source: literal, value: { Deployment: 1 } }" tone={TONE_OK} />
          <RefField name="fields" desc="namespace + expect with paths — checks fields are PRESENT (not their value)." tone={TONE_OK} />
          <RefField name="value" desc="namespace + assert: [{ select, path, op: '==', value }] — checks an exact value." tone={TONE_OK} />
          <Code tone={TONE_OK}>{`\`\`\`vpk-check\nid: my-check\ndescribe: Deployment exists and is Ready\nkind: inventory\nnamespace: default\nexpect: { source: literal, value: { Deployment: 1 } }\n\`\`\``}</Code>
        </BlockCard>
        <BlockCard chip="Task" tone={TONE_TASK} title="vpk-task block (Start/Complete lifecycle)">
          <p style={{ ...mutedStyle, lineHeight: 1.5 }}>
            Fenced ```vpk-task block — a completable unit with its own Start/Complete buttons, additive
            alongside vpk-check (which keeps its single "Run check" button, no lifecycle). "manual" completion
            is self-attested by the student; "auto" arms background polling of an author-run command until it
            passes or gives up (see below).
          </p>
          <RefField name="id" desc="Unique within the lesson." tone={TONE_TASK} />
          <RefField name="describe" desc="Shown as the card's title. Falls back to id if omitted." tone={TONE_TASK} />
          <RefField name="completion" desc='"manual" (Start + self-attested Complete) or "auto" (Start arms polling).' tone={TONE_TASK} />
          <RefField
            name="estimatedMinutes"
            desc='Required for "auto" — polling gives up after estimatedMinutes × 1.25, then the student re-checks from the Progress modal. Unused for "manual".'
            tone={TONE_TASK}
          />
          <RefField
            name="check"
            desc="verb + args (argv after the CLI) + expect: { path?, op, value }. Runs SERVER-SIDE, not typed by the student — still gated by this lesson's own allow list, PLUS a separate student-granted approval (per course or for all courses) before the server will ever auto-run it. path resolves into the command's stdout parsed as JSON (dotted, [*] wildcards supported, same convention as vpk-check's fields kind); omit path to compare the whole value. op is ==, >=, <=, matches (regex), or contains (substring, for non-JSON stdout)."
            tone={TONE_TASK}
          />
          <Code tone={TONE_TASK}>{`\`\`\`vpk-task\nid: deploy-ready\ndescribe: Deployment rolled out\ncompletion: auto\nestimatedMinutes: 5\ncheck:\n  verb: get\n  args: [deployment, my-app, -n, default, -o, json]\n  expect:\n    path: .status.readyReplicas\n    op: '=='\n    value: 1\n\`\`\``}</Code>
        </BlockCard>
        <BlockCard chip="Authored only" tone={TONE_IDLE} title="Other fences (not yet automated)">
          <RefField name="vpk-detect" desc="Environment probe shown as a card (context, provisioner, nodes)." tone={TONE_IDLE} first />
          <RefField name="vpk-setup / vpk-teardown / vpk-quiz" desc="Parsed and shown as a placeholder card — not yet run automatically." tone={TONE_IDLE} />
        </BlockCard>
      </div>
    </div>
  );
}

function RefField({ name, desc, tone, first = false }: { name: string; desc: string; tone: CardTone; first?: boolean }) {
  return (
    <div className={`flex items-start gap-2 py-1.5 ${first ? '' : 'border-t'}`} style={{ borderColor: 'var(--vpk-border)' }}>
      <code className="font-mono rounded shrink-0" style={{ background: tone.soft, color: tone.base, padding: '1px 6px', fontSize: 11 }}>
        {name}
      </code>
      <span style={{ ...mutedStyle, lineHeight: 1.5 }}>{desc}</span>
    </div>
  );
}

function Code({ children, tone }: { children: string; tone: CardTone }) {
  return (
    <pre className="font-mono whitespace-pre-wrap p-2.5 rounded border overflow-auto text-[11px] mt-1.5" style={{ borderColor: 'var(--vpk-border)', background: tone.soft }}>
      {children}
    </pre>
  );
}
