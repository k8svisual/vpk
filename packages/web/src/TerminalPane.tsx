import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ListChecks, PanelBottom, PanelRight, SquareArrowOutUpRight, Terminal as TerminalIcon, TriangleAlert, X } from 'lucide-react';
import type { CourseLayout, TerminalTheme } from './courseSettings';
import { getBinaryPath, setBinaryPath } from './commandApproval';
import { initialExtraAllowedVerbs } from './terminalAllowlist';
import { CliPathFixer } from './CliPathFixer';

/**
 * The lesson terminal — extracted out of LessonRunnerView.tsx (not just a local function there) specifically
 * so it can be mounted TWICE from two different entry points: embedded in the Course view, and standalone in
 * TerminalPopout.tsx's own window (see App.tsx's "Pop out Terminal" button / main.tsx's `?popout=terminal`
 * branch). That's also why this file has its own tiny postJson — LessonRunnerView.tsx's copy stays private to
 * it, since sharing it would mean the popout bundle drags in all of LessonRunnerView's other imports too.
 *
 * `layout`/`onToggleLayout` (Stack vs Side-by-side) and `onPopOut` are each optional and independently
 * omittable: the popout window passes neither (there's no "layout" or "pop out" concept once you're already a
 * separate window), while the embedded instance passes both.
 */

interface CommandResult {
  argv: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

interface HistoryEntry {
  line: string;
  result?: CommandResult;
  error?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

/** If `path` is a resolved override for the CLI the student was shown (`bareName`), rewrite just the LEADING
 *  token of a typed command line to that path before sending it to the server — /course/command's own policy
 *  check requires the tokenized line and the separately-sent `cli` field to agree (see
 *  server/src/course/command.ts's checkCommandPolicy), and the actual spawn uses argv[0] from the line itself,
 *  not the `cli` field, so a stored override does nothing for real execution unless the line's own leading
 *  word is substituted too — not just the `cli` field. Only rewrites a whole leading word (never a substring
 *  buried in a later argument); a command that doesn't actually start with `bareName` is left untouched and
 *  reported to the server as-is, so it gets the server's own normal "only X commands are allowed here" error
 *  instead of being silently rewritten into something the student didn't type. */
function resolveLeadingCli(cmd: string, bareName: string, path: string | null): { sentLine: string; sentCli: string } {
  if (!path || path === bareName) return { sentLine: cmd, sentCli: bareName };
  const escaped = bareName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(?=\\s|$)`);
  if (!re.test(cmd)) return { sentLine: cmd, sentCli: bareName };
  return { sentLine: cmd.replace(re, path), sentCli: path };
}

const TERMINAL_COLORS: Record<TerminalTheme, { bg: string; fg: string; border: string; mutedFg: string; inputBg: string; buttonBg: string; errorFg: string }> = {
  // var(--vpk-status-error) is tuned for the app's light surfaces — too dark to read on pure black, so the
  // terminal gets its own brighter red independent of the app-wide error color.
  dark: { bg: '#000000', fg: '#f5f5f5', border: '#6b6b6b', mutedFg: '#9a9a9a', inputBg: '#454545', buttonBg: '#6e6e6e', errorFg: '#ff6b6b' },
  light: { bg: '#ffffff', fg: '#111111', border: '#cccccc', mutedFg: '#555555', inputBg: '#f2f2f2', buttonBg: '#e2e2e2', errorFg: 'var(--vpk-status-error)' },
};

const CLEAR_COMMANDS = new Set(['clear', 'cls']);

// Plain-English gloss for the verbs a lesson commonly allows — shown by the "Allowed" popover below so a
// student can see not just WHICH verbs work here but what each one actually does, without leaving the
// terminal. Mirrors (but doesn't import) server/src/course/command.ts's MUTATING_VERBS/checkCommandPolicy —
// that's the actual enforcement, this is just documentation for the student; a verb missing from this map
// still works fine if the lesson allows it, it just falls back to the generic description below.
const VERB_DESCRIPTIONS: Record<string, string> = {
  get: 'List or show one or more resources',
  describe: 'Show detailed information about a resource',
  logs: 'Print a container’s logs',
  explain: 'Show documentation for a resource type’s fields',
  top: 'Show current CPU/memory usage',
  exec: 'Run a command inside a container',
  'port-forward': 'Forward a local port to a Pod or Service',
  cp: 'Copy files to or from a container',
  events: 'List recent Events',
  diff: 'Show what apply would change, without changing anything',
  wait: 'Wait for a condition on a resource',
  apply: 'Create or update a resource from a file/manifest',
  create: 'Create a new resource',
  delete: 'Delete a resource',
  edit: 'Edit a resource directly',
  patch: 'Update specific fields of a resource',
  replace: 'Replace an existing resource',
  scale: 'Change a workload’s replica count',
  label: 'Add, change, or remove labels on a resource',
  annotate: 'Add, change, or remove annotations on a resource',
  set: 'Update specific fields (image, resources, …) on a resource',
  rollout: 'Manage a workload’s rollout — status, history, undo, restart',
  expose: 'Create a Service for an existing resource',
  taint: 'Add or remove a taint on a Node',
  drain: 'Safely evict every Pod from a Node for maintenance',
  cordon: 'Mark a Node unschedulable',
  uncordon: 'Mark a Node schedulable again',
  run: 'Run a new Pod directly from an image',
};
const GENERIC_VERB_DESCRIPTION = 'Kubernetes CLI verb';

// The whole visible terminal session — input line, run transcript, and Up/Down recall log — carries across a
// pop-out/pop-in via localStorage (not sessionStorage — sessionStorage only clones ONCE, at the moment
// window.open() creates the popup, so edits afterward wouldn't flow either direction; localStorage is the one
// that's genuinely live-shared across same-origin windows after they're created). Both windows write the
// whole session on every change and read it once at mount, which is enough here since the embedded pane and
// the popout are never mounted at the same time (one side is always the "Terminal is open in a separate
// window" placeholder instead) — there's no simultaneous-edit case to reconcile, so a live sync channel like
// BroadcastChannel isn't needed.
interface TerminalSession {
  line: string;
  history: HistoryEntry[];
  commandLog: string[];
}

const SESSION_KEY = 'vpk-terminal-session';

function getStoredSession(): TerminalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TerminalSession) : null;
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts, or the JSON could be corrupt — either way, just skip restoring
  }
}

function setStoredSession(session: TerminalSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // best-effort — a failed write (quota exceeded, locked-down storage) just means pop-out/pop-in won't carry the session, not worth surfacing
  }
}

export function TerminalPane({
  allow,
  cli,
  theme,
  fontSizePx,
  layout,
  onToggleLayout,
  onPopOut,
}: {
  allow: string[];
  cli?: string[];
  theme: TerminalTheme;
  fontSizePx: number;
  layout?: CourseLayout;
  onToggleLayout?: () => void;
  onPopOut?: () => void;
}) {
  const cliName = cli?.[0] ?? 'kubectl';
  const [line, setLine] = useState(() => getStoredSession()?.line ?? `${cliName} get nodes`);
  const [history, setHistory] = useState<HistoryEntry[]>(() => getStoredSession()?.history ?? []);
  const [running, setRunning] = useState(false);
  // Shell-style Up/Down recall over PAST TYPED COMMANDS — kept in its own log, separate from `history` (the
  // visible transcript), so `clear`/`cls` can wipe the screen without erasing recall, matching real shells.
  // null = not currently browsing (the input holds whatever the student is actively typing); draftRef
  // preserves that in-progress text so pressing Down back past the oldest browsed entry restores it.
  const [commandLog, setCommandLog] = useState<string[]>(() => getStoredSession()?.commandLog ?? []);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [showAllowed, setShowAllowed] = useState(false);
  // null = still probing (or not probed yet this mount); true/false once /course/probe-cli answers. An
  // already-saved override (Settings > Education's tester, or resolving it right here) short-circuits this to
  // true without re-probing every mount — same trust model LessonRunnerView's runPreflight already uses.
  const [binaryFound, setBinaryFound] = useState<boolean | null>(() => (getBinaryPath(cliName) ? true : null));
  const draftRef = useRef('');
  const colors = TERMINAL_COLORS[theme];
  // Layered on top of whatever the lesson itself declares — see terminalAllowlist.ts's own doc comment for why
  // that's safe in this app's single-tenant model. Read fresh on every render (cheap: one localStorage hit +
  // JSON.parse) rather than cached in state, so editing the list in Settings while a lesson is already open is
  // reflected the next time this component re-renders for any reason, without extra plumbing to subscribe to it.
  const effectiveAllow = Array.from(new Set([...allow, ...initialExtraAllowedVerbs()]));

  useEffect(() => {
    setStoredSession({ line, history, commandLog });
  }, [line, history, commandLog]);

  useEffect(() => {
    if (getBinaryPath(cliName)) {
      setBinaryFound(true);
      return;
    }
    setBinaryFound(null);
    let cancelled = false;
    postJson<{ found: boolean }>('/course/probe-cli', { cli: cliName })
      .then((res) => {
        if (!cancelled) setBinaryFound(res.found);
      })
      .catch(() => {
        if (!cancelled) setBinaryFound(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cliName]);

  async function run() {
    const cmd = line.trim();
    if (!cmd) return;
    setHistoryIndex(null);
    setCommandLog((p) => [...p, cmd]);
    if (CLEAR_COMMANDS.has(cmd.toLowerCase())) {
      setHistory([]);
      setLine('');
      return;
    }
    setRunning(true);
    try {
      const { sentLine, sentCli } = resolveLeadingCli(cmd, cliName, getBinaryPath(cliName));
      const result = await postJson<CommandResult>('/course/command', { line: sentLine, allow: effectiveAllow, cli: sentCli });
      setHistory((p) => [...p, { line: cmd, result }]);
    } catch (e: unknown) {
      setHistory((p) => [...p, { line: cmd, error: String(e instanceof Error ? e.message : e) }]);
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void run();
      return;
    }
    if (e.key === 'ArrowUp') {
      if (commandLog.length === 0) return;
      e.preventDefault();
      if (historyIndex === null) {
        draftRef.current = line;
        setHistoryIndex(commandLog.length - 1);
        setLine(commandLog[commandLog.length - 1] ?? '');
      } else if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setLine(commandLog[historyIndex - 1] ?? '');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      if (historyIndex === null) return;
      e.preventDefault();
      if (historyIndex < commandLog.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setLine(commandLog[historyIndex + 1] ?? '');
      } else {
        setHistoryIndex(null);
        setLine(draftRef.current);
      }
    }
  }

  return (
    <div className="border rounded flex flex-col h-full" style={{ borderColor: colors.border, background: colors.bg, color: colors.fg }}>
      <div className="relative px-3 py-2 border-b flex items-center justify-between gap-1.5 text-xs font-medium" style={{ borderColor: colors.border }}>
        <span className="flex items-center gap-1.5">
          <TerminalIcon size={13} />
          Terminal
        </span>
        <span className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAllowed((v) => !v)}
            className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer"
            style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
            title="Show every command allowed in this terminal"
          >
            <ListChecks size={12} />
            Allowed
          </button>
          {onPopOut && (
            <button
              onClick={onPopOut}
              className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer"
              style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
              title="Open the terminal in its own window, freeing full width for the lesson"
            >
              <SquareArrowOutUpRight size={12} />
              Pop out
            </button>
          )}
          {onToggleLayout && (
            <button
              onClick={onToggleLayout}
              className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer"
              style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
              title={layout === 'row' ? 'Move course content above the terminal (wider terminal)' : 'Move course content back beside the terminal'}
            >
              {layout === 'row' ? <PanelBottom size={12} /> : <PanelRight size={12} />}
              {layout === 'row' ? 'Stack' : 'Side-by-side'}
            </button>
          )}
        </span>
        {showAllowed && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowAllowed(false)} />
            <div
              className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-80 overflow-auto rounded border p-3 text-left font-normal shadow-lg"
              style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">Allowed in this terminal</span>
                <button onClick={() => setShowAllowed(false)} className="cursor-pointer" style={{ color: colors.mutedFg }} aria-label="Close">
                  <X size={13} />
                </button>
              </div>
              <p className="mb-2" style={{ color: colors.mutedFg }}>
                Only <code>{cliName}</code> commands run here — anything else is rejected before it runs.
              </p>
              <ul className="mb-3 space-y-1">
                {effectiveAllow.map((verb) => (
                  <li key={verb}>
                    <code className="font-semibold">{verb}</code>
                    <span style={{ color: colors.mutedFg }}> — {VERB_DESCRIPTIONS[verb] ?? GENERIC_VERB_DESCRIPTION}</span>
                    {!allow.includes(verb) && <span style={{ color: colors.mutedFg }}> (added by you — Settings &gt; Education)</span>}
                  </li>
                ))}
              </ul>
              <p className="border-t pt-2" style={{ borderColor: colors.border, color: colors.mutedFg }}>
                Always blocked, regardless of the list above: deleting a Node, and any mutating verb combined
                with -A/--all-namespaces.
              </p>
            </div>
          </>
        )}
      </div>
      {binaryFound === false ? (
        <div className="mx-3 mt-2 space-y-1.5 rounded border p-2 text-xs" style={{ borderColor: colors.errorFg }}>
          <p className="flex items-center gap-1.5" style={{ color: colors.errorFg }}>
            <TriangleAlert size={13} />
            <code>{cliName}</code> wasn't found on this machine's PATH.
          </p>
          <CliPathFixer
            cli={cliName}
            colors={colors}
            onResolved={(path) => {
              setBinaryPath(cliName, path);
              setBinaryFound(true);
            }}
          />
        </div>
      ) : (
        <p className="px-3 pt-2 text-xs" style={{ color: colors.mutedFg }}>
          Runs <code>{cliName}</code> only — allowed here: {effectiveAllow.join(', ')}. For minikube/k3d/other
          cluster tools, use your own system terminal. ↑/↓ recall previous commands, <code>clear</code>/
          <code>cls</code> wipes the screen. Appearance, font size, and CLI are in Settings &gt; Education.
        </p>
      )}
      <div className="flex gap-2 p-2 border-b" style={{ borderColor: colors.border }}>
        <input
          value={line}
          onChange={(e) => {
            setHistoryIndex(null);
            setLine(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 rounded border font-mono"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg, fontSize: fontSizePx }}
        />
        <button
          onClick={() => void run()}
          disabled={running}
          className="text-xs px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed"
          style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
        >
          {running ? '…' : 'Run'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2 space-y-3 font-mono min-h-0" style={{ fontSize: fontSizePx }}>
        {[...history].reverse().map((entry, i) => (
          <div key={history.length - 1 - i}>
            <div className="font-semibold">$ {entry.line}</div>
            {entry.result && (
              <>
                <div style={{ color: colors.mutedFg }}>
                  exit {entry.result.exitCode ?? 'aborted'} ({entry.result.durationMs}ms)
                </div>
                {entry.result.stdout && <pre className="whitespace-pre-wrap">{entry.result.stdout}</pre>}
                {entry.result.stderr && (
                  <pre className="whitespace-pre-wrap" style={{ color: colors.errorFg }}>
                    {entry.result.stderr}
                  </pre>
                )}
              </>
            )}
            {entry.error && (
              <pre className="whitespace-pre-wrap" style={{ color: colors.errorFg }}>
                {entry.error}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
