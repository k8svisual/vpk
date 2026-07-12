import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ListChecks, PanelBottom, PanelRight, SquareArrowOutUpRight, Terminal as TerminalIcon, TriangleAlert, X } from 'lucide-react';
import type { CourseLayout, TerminalTheme } from './courseSettings';
import { getBinaryPath, setBinaryPath } from './commandApproval';
import { initialExtraAllowedBinaries, initialExtraAllowedVerbs } from './terminalAllowlist';
import { CliPathFixer } from './CliPathFixer';
import { GENERIC_VERB_DESCRIPTION, VERB_DESCRIPTIONS } from './verbDescriptions';

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
  /** Set when `error` looks like "binary not found" — the bare candidate name (cliName or one of
   *  extraBinaries) that was actually attempted, so the transcript can offer CliPathFixer inline for exactly
   *  that command instead of the student having to go find it in Settings. */
  fixableCli?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

function leadingWordMatches(cmd: string, bareName: string): boolean {
  const escaped = bareName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?=\\s|$)`).test(cmd);
}

/** Rewrites just the LEADING token of a typed command line to its resolved path override before sending it to
 *  the server — /course/command's own policy check requires the tokenized line and the separately-sent `cli`/
 *  `extraBinaries` fields to agree (see server/src/course/command.ts's checkCommandPolicy), and the actual
 *  spawn uses argv[0] from the line itself, not those fields, so a stored override does nothing for real
 *  execution unless the line's own leading word is substituted too.
 *
 *  Tries `candidates` (the primary `cli` bare name, then any extra standalone binaries — see
 *  terminalAllowlist.ts) in order and reports which one actually matched, so callers know both what to send
 *  AND what a failure should offer to fix. Returns null if the typed line doesn't start with any candidate at
 *  all — left untouched in that case, so it's reported to the server as-is and gets the server's own normal
 *  "only X commands are allowed here" error instead of being silently rewritten into something the student
 *  didn't type. */
function resolveLeadingCommand(cmd: string, candidates: string[]): { sentLine: string; bareName: string } | null {
  for (const bareName of candidates) {
    if (!leadingWordMatches(cmd, bareName)) continue;
    const path = getBinaryPath(bareName);
    if (!path || path === bareName) return { sentLine: cmd, bareName };
    const escaped = bareName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { sentLine: cmd.replace(new RegExp(`^${escaped}(?=\\s|$)`), path), bareName };
  }
  return null;
}

const TERMINAL_COLORS: Record<TerminalTheme, { bg: string; fg: string; border: string; mutedFg: string; inputBg: string; buttonBg: string; errorFg: string; okFg: string }> = {
  // var(--vpk-status-error)/var(--vpk-status-ok) are tuned for the app's light surfaces — too dark/muddy to
  // read on pure black, so the terminal gets its own brighter red/green independent of the app-wide colors.
  dark: { bg: '#000000', fg: '#f5f5f5', border: '#6b6b6b', mutedFg: '#9a9a9a', inputBg: '#454545', buttonBg: '#6e6e6e', errorFg: '#ff6b6b', okFg: '#4ade80' },
  light: {
    bg: '#ffffff',
    fg: '#111111',
    border: '#cccccc',
    mutedFg: '#555555',
    inputBg: '#f2f2f2',
    buttonBg: '#e2e2e2',
    errorFg: 'var(--vpk-status-error)',
    okFg: 'var(--vpk-status-ok)',
  },
};

const CLEAR_COMMANDS = new Set(['clear', 'cls']);

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
  confirmDelete = true,
  theme,
  fontSizePx,
  layout,
  onToggleLayout,
  onPopOut,
}: {
  allow: string[];
  cli?: string[];
  /** Whether a `delete` asks for confirmation before running — the lesson's own frontmatter opt-out (a
   *  delete-heavy course sets it false). Defaults to true (confirm shown). */
  confirmDelete?: boolean;
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
  // A `<cli> delete …` command the student has entered but not yet confirmed — the UI guardrail that replaces
  // the old server-side "deleting is blocked" rule (VpK deliberately lets a student delete on their own
  // training cluster, but a stray Enter shouldn't wipe something out unprompted). null = nothing pending.
  const [confirmCmd, setConfirmCmd] = useState<string | null>(null);
  const draftRef = useRef('');
  const colors = TERMINAL_COLORS[theme];
  // Layered on top of whatever the lesson itself declares — see terminalAllowlist.ts's own doc comment for why
  // that's safe in this app's single-tenant model. Read fresh on every render (cheap: one localStorage hit +
  // JSON.parse) rather than cached in state, so editing the list in Settings while a lesson is already open is
  // reflected the next time this component re-renders for any reason, without extra plumbing to subscribe to it.
  const effectiveAllow = Array.from(new Set([...allow, ...initialExtraAllowedVerbs()]));
  // Whole extra binaries (grep, jq, curl, ...) the student opted into in Settings > Education — read fresh
  // each render for the same reason as effectiveAllow above. Bare names as typed; path overrides are resolved
  // per-candidate at run() time, same as cliName's own override.
  const extraBinaries = initialExtraAllowedBinaries();

  // Persist the whole session (input line + transcript + recall) so it carries across a pop-out/pop-in. Debounce
  // the write rather than stringifying the entire (possibly large) session on every keystroke — but flush the
  // latest synchronously on unmount, because a pop-out unmounts this pane and the popup reads the session right
  // after, so a pending debounced write must not be dropped.
  const sessionRef = useRef({ line, history, commandLog });
  sessionRef.current = { line, history, commandLog };
  useEffect(() => {
    const t = setTimeout(() => setStoredSession(sessionRef.current), 250);
    return () => clearTimeout(t);
  }, [line, history, commandLog]);
  useEffect(() => () => setStoredSession(sessionRef.current), []);

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

  // True for a `<cli> delete …` command (not a standalone binary) — used to gate it behind a confirm.
  function isDeleteCommand(cmd: string): boolean {
    const tokens = cmd.split(/\s+/).filter(Boolean);
    const cliArgv = cli && cli.length > 0 ? cli : [cliName];
    if (!cliArgv.every((part, i) => tokens[i] === part)) return false; // an extra standalone binary — no verb concept
    return tokens[cliArgv.length] === 'delete';
  }

  // Runs one command through the gates (clear-screen, then the delete confirm) — shared by the input's Run/Enter
  // and by the "re-run after fixing the CLI path" retry, so both honor the same confirm behavior.
  async function submit(cmd: string) {
    if (running) return; // the Run button is disabled while running, but Enter isn't — guard against a fast double-Enter firing two concurrent posts of the same line
    if (!cmd) return;
    if (CLEAR_COMMANDS.has(cmd.toLowerCase())) {
      setHistoryIndex(null);
      setCommandLog((p) => [...p, cmd]);
      setConfirmCmd(null);
      setHistory([]);
      setLine('');
      return;
    }
    if (confirmDelete && isDeleteCommand(cmd)) {
      setConfirmCmd(cmd); // ask before deleting — the student explicitly confirms via the banner below
      return;
    }
    await execute(cmd);
  }

  async function run() {
    await submit(line.trim());
  }

  async function execute(cmd: string) {
    setConfirmCmd(null);
    setHistoryIndex(null);
    setCommandLog((p) => [...p, cmd]);
    setRunning(true);
    const candidates = [cliName, ...extraBinaries];
    const matched = resolveLeadingCommand(cmd, candidates);
    const sentLine = matched?.sentLine ?? cmd;
    const sentCli = getBinaryPath(cliName) ?? cliName;
    const sentExtraBinaries = extraBinaries.map((b) => getBinaryPath(b) ?? b);
    try {
      const result = await postJson<CommandResult>('/course/command', { line: sentLine, allow: effectiveAllow, cli: sentCli, extraBinaries: sentExtraBinaries });
      setHistory((p) => [...p, { line: cmd, result }]);
    } catch (e: unknown) {
      const message = String(e instanceof Error ? e.message : e);
      const fixableCli = /not found/i.test(message) ? (matched?.bareName ?? cliName) : undefined;
      setHistory((p) => [...p, { line: cmd, error: message, fixableCli }]);
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
                Only <code>{cliName}</code> commands{extraBinaries.length > 0 ? ', plus the standalone commands below,' : ''} run here —
                anything else is rejected before it runs.
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
              {extraBinaries.length > 0 && (
                <>
                  <p className="mb-1 border-t pt-2 font-semibold" style={{ borderColor: colors.border }}>
                    Standalone commands (added by you)
                  </p>
                  <ul className="mb-3 space-y-1">
                    {extraBinaries.map((name) => (
                      <li key={name}>
                        <code className="font-semibold">{name}</code>
                        <span style={{ color: colors.mutedFg }}> — runs directly, not gated by verb</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="border-t pt-2" style={{ borderColor: colors.border, color: colors.mutedFg }}>
                This is a real cluster — nothing here is held back
                {confirmDelete ? (
                  <>
                    , though a <code>delete</code> asks you to confirm first
                  </>
                ) : (
                  ''
                )}
                . Run it against a cluster you can afford to break.
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
          Runs <code>{cliName}</code>
          {extraBinaries.length > 0 && (
            <>
              {' '}
              (plus <code>{extraBinaries.join(', ')}</code>)
            </>
          )}{' '}
          — allowed here: {effectiveAllow.join(', ')}. For minikube/k3d/other cluster tools, use your own system
          terminal. ↑/↓ recall previous commands, <code>clear</code>/<code>cls</code> wipes the screen. Appearance,
          font size, and additional commands are in Settings &gt; Education.
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
      {confirmCmd && (
        <div className="mx-2 mt-2 rounded border p-2 text-xs" style={{ borderColor: colors.errorFg }}>
          <p className="flex items-center gap-1.5" style={{ color: colors.errorFg }}>
            <TriangleAlert size={13} />
            This deletes resources from the live cluster. Run it?
          </p>
          <pre className="my-1.5 whitespace-pre-wrap" style={{ color: colors.fg, fontSize: fontSizePx }}>$ {confirmCmd}</pre>
          <div className="flex gap-2">
            <button
              onClick={() => void execute(confirmCmd)}
              className="rounded border px-2 py-1 cursor-pointer"
              style={{ borderColor: colors.errorFg, color: colors.errorFg }}
            >
              Run delete
            </button>
            <button
              onClick={() => setConfirmCmd(null)}
              className="rounded border px-2 py-1 cursor-pointer"
              style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
              <>
                <pre className="whitespace-pre-wrap" style={{ color: colors.errorFg }}>
                  {entry.error}
                </pre>
                {entry.fixableCli && (
                  <div className="mt-1 max-w-sm">
                    <CliPathFixer
                      cli={entry.fixableCli}
                      colors={colors}
                      onResolved={(path) => {
                        setBinaryPath(entry.fixableCli as string, path);
                        if (entry.fixableCli === cliName) setBinaryFound(true);
                        void submit(entry.line); // re-run the command that failed, now that its binary is resolved
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
