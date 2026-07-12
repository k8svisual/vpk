import type { ReactNode } from 'react';
import type { TerminalTheme } from './courseSettings';

/**
 * Colorizes the terminal's command output. Two independent modes, chosen per-output by hasAnsi():
 *
 *  1. ANSI passthrough — for standalone tools the student enabled that DO emit color (e.g. `grep
 *     --color=always`, git). We parse the SGR escape codes and render them, so those commands keep their
 *     native colors.
 *  2. Semantic k8s highlighting — for kubectl/oc, which emit NO color of their own (the server spawns them
 *     without a TTY, and `kubectl get` isn't colorized even on one). So the green/red/amber has to come from
 *     us reading the text: STATUS-style tokens are classified (Running/Ready green, CrashLoopBackOff/Error red,
 *     Pending/Terminating amber), ready-ratios like 1/1 vs 0/1 are colored, and the all-caps header row dims.
 *
 * The classification is intentionally a scanning aid, not a parser — it matches whole whitespace-delimited
 * tokens against keyword sets, so it can't mistake a substring inside a pod name for a status, but it also
 * doesn't try to understand columns. Good enough to make `kubectl get pods` scannable at a glance.
 */

export type SpanKind = 'plain' | 'ok' | 'err' | 'warn' | 'dim';
export interface Span {
  text: string;
  kind: SpanKind;
}

// Whole-token status vocabularies. Matched case-sensitively against a full token (see classifyToken) — k8s
// prints these in fixed casing, and case-sensitivity avoids coloring an English word like "ready" in a log
// line. NotReady/ImagePullBackOff etc. are their own tokens, so they never collide with the shorter Ready.
const OK_WORDS = new Set([
  'Running', 'Ready', 'Completed', 'Complete', 'Active', 'Bound', 'Healthy', 'Available', 'Succeeded',
  'Success', 'Established', 'Normal', 'True', 'Online', 'Valid', 'Enabled', 'Approved', 'Deployed',
]);
const ERR_WORDS = new Set([
  'Error', 'CrashLoopBackOff', 'Failed', 'Failure', 'Evicted', 'OOMKilled', 'ImagePullBackOff', 'ErrImagePull',
  'ErrImageNeverPull', 'InvalidImageName', 'CreateContainerConfigError', 'CreateContainerError',
  'RunContainerError', 'NotReady', 'Unhealthy', 'BackOff', 'Unavailable', 'Lost', 'Unschedulable', 'False',
  'Offline', 'Rejected', 'Forbidden', 'Unknown', 'Denied', 'Degraded', 'NodeNotReady',
]);
const WARN_WORDS = new Set([
  'Pending', 'Terminating', 'ContainerCreating', 'PodInitializing', 'Initializing', 'Waiting', 'Progressing',
  'Warning', 'Provisioning', 'Creating', 'Updating', 'ScalingUp', 'ScalingDown',
]);

function classifyToken(token: string): SpanKind {
  // Ready-ratio columns (READY = x/y): all up → ok, some down → warn. Also matches nodes' "3/3".
  const ratio = /^(\d+)\/(\d+)$/.exec(token);
  if (ratio) {
    const have = Number(ratio[1]);
    const want = Number(ratio[2]);
    return want > 0 && have === want ? 'ok' : 'warn';
  }
  // Init containers print as `Init:0/1`, `Init:Error`, `Init:CrashLoopBackOff` — one token, always transitional
  // or failed; treat the whole token as warn unless it names a hard error.
  if (token.startsWith('Init:')) return ERR_WORDS.has(token.slice(5)) ? 'err' : 'warn';
  if (OK_WORDS.has(token)) return 'ok';
  if (ERR_WORDS.has(token)) return 'err';
  if (WARN_WORDS.has(token)) return 'warn';
  return 'plain';
}

// An all-caps column header line (NAME  STATUS  ROLES  AGE): dim the whole thing so the data rows stand out.
export function isHeaderLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  return tokens.every((t) => /^[A-Z][A-Z0-9_%().:/-]*$/.test(t));
}

/** One line of kubectl/oc output → colored spans. Splits on whitespace but keeps the whitespace runs (so the
 *  original column alignment is preserved exactly) and classifies each non-space token. */
export function highlightLine(line: string): Span[] {
  if (isHeaderLine(line)) return [{ text: line, kind: 'dim' }];
  // split(/(\s+)/) yields [token, space, token, space, ...] — whitespace lands on odd indices.
  return line.split(/(\s+)/).map((part) => {
    if (part === '' || /^\s+$/.test(part)) return { text: part, kind: 'plain' as SpanKind };
    return { text: part, kind: classifyToken(part) };
  });
}

// ── ANSI (SGR) parsing ───────────────────────────────────────────────────────────────────────────────────
export interface AnsiRun {
  text: string;
  color: string | null;
  bold: boolean;
}

const ANSI_RE = /\x1b\[([0-9;]*)m/g;
// Any escape at all routes output through the ANSI path — a tool that colorizes also emits non-color control
// sequences (erase-line, cursor moves), and those must be stripped, not leaked as literal text.
const HAS_ANSI_RE = /\x1b/;
// Non-SGR CSI sequences (anything ending in a letter other than `m`) + OSC title strings — consumed and
// dropped so `grep --color`'s `\x1b[K` and friends never render as garbage.
const NON_SGR_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-LN-Za-ln-z]|\x1b[()][AB0]/g;

export function hasAnsi(text: string): boolean {
  return HAS_ANSI_RE.test(text);
}

interface Palette {
  normal: string[]; // 8 base colors, index 0-7 (black..white)
  bright: string[]; // 8 bright colors, index 0-7
}

// Terminal-tuned palettes (the pane's bg is black in the dark theme, white in the light one), so each theme
// gets colors that stay legible on its own background rather than a single fixed 16-color set.
export const ANSI_PALETTES: Record<TerminalTheme, Palette> = {
  dark: {
    normal: ['#5c6370', '#ff6b6b', '#4ade80', '#e0b23a', '#6ea8fe', '#d68bff', '#56c9d6', '#f5f5f5'],
    bright: ['#8a8a8a', '#ff8787', '#86efac', '#f2cd5c', '#93c5fd', '#e2b3ff', '#7ee0ea', '#ffffff'],
  },
  light: {
    normal: ['#3b3b3b', '#c0392b', '#2e8b57', '#b8860b', '#2a5db0', '#8e44ad', '#0e7490', '#111111'],
    bright: ['#555555', '#e2564a', '#2f9e5f', '#d4a017', '#3b7dd8', '#a55bc9', '#1596ad', '#000000'],
  },
};

function xterm256ToHex(n: number): string {
  if (n < 16) {
    // The 16 system colors — reuse a mid-contrast set that works on either background.
    const sys = ['#000000', '#c0392b', '#2e8b57', '#b8860b', '#2a5db0', '#8e44ad', '#0e7490', '#c0c0c0',
      '#5c6370', '#ff6b6b', '#4ade80', '#e0b23a', '#6ea8fe', '#d68bff', '#56c9d6', '#ffffff'];
    return sys[n] ?? '#f5f5f5';
  }
  if (n >= 232) {
    const v = 8 + (n - 232) * 10; // grayscale ramp
    const h = v.toString(16).padStart(2, '0');
    return `#${h}${h}${h}`;
  }
  const c = n - 16;
  const r = Math.floor(c / 36);
  const g = Math.floor((c % 36) / 6);
  const b = c % 6;
  const step = (x: number) => (x === 0 ? 0 : 55 + x * 40).toString(16).padStart(2, '0');
  return `#${step(r)}${step(g)}${step(b)}`;
}

/** Parse SGR sequences into styled runs. Recognizes reset, bold, the 30-37/90-97 foreground colors, 39
 *  (default), and 38;5;n / 38;2;r;g;b extended foregrounds; background and other attributes are consumed and
 *  dropped so their codes never leak into the visible text. */
export function parseAnsiRuns(rawText: string, palette: Palette): AnsiRun[] {
  const text = rawText.replace(NON_SGR_RE, '');
  const runs: AnsiRun[] = [];
  let cursor = 0;
  let color: string | null = null;
  let bold = false;

  const push = (end: number) => {
    if (end > cursor) runs.push({ text: text.slice(cursor, end), color, bold });
  };

  ANSI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANSI_RE.exec(text))) {
    push(m.index);
    const params = m[1] ?? '';
    const codes = params === '' ? [0] : params.split(';').map((n) => Number(n));
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === undefined) continue;
      if (code === 0) {
        color = null;
        bold = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 22) {
        bold = false;
      } else if (code === 39) {
        color = null;
      } else if (code >= 30 && code <= 37) {
        color = (bold ? palette.bright : palette.normal)[code - 30] ?? null;
      } else if (code >= 90 && code <= 97) {
        color = palette.bright[code - 90] ?? null;
      } else if (code === 38) {
        // Extended foreground: 38;5;n (256-color) or 38;2;r;g;b (truecolor). Consume the sub-args.
        if (codes[i + 1] === 5) {
          color = xterm256ToHex(codes[i + 2] ?? 0);
          i += 2;
        } else if (codes[i + 1] === 2) {
          const [r, g, b] = [codes[i + 2] ?? 0, codes[i + 3] ?? 0, codes[i + 4] ?? 0];
          color = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
          i += 4;
        }
      }
      // Anything else (backgrounds 40-49, underline, etc.) is intentionally ignored — the code is still
      // consumed by the regex, so it won't render as literal text.
    }
    cursor = ANSI_RE.lastIndex;
  }
  push(text.length);
  return runs;
}

// Above this size, skip highlighting entirely and render plain text — a multi-megabyte dump split into
// per-token spans would create a huge DOM for no teaching benefit.
const MAX_HIGHLIGHT_BYTES = 100_000;

interface OutputColors {
  fg: string;
  okFg: string;
  errorFg: string;
  warnFg: string;
  mutedFg: string;
}

/** The render entry point used by TerminalPane. Returns colored inline content for one command's stdout,
 *  picking ANSI vs semantic mode automatically; falls back to plain text for oversized output. */
export function renderTerminalOutput(text: string, theme: TerminalTheme, colors: OutputColors): ReactNode {
  if (text.length > MAX_HIGHLIGHT_BYTES) return text;

  if (hasAnsi(text)) {
    const runs = parseAnsiRuns(text, ANSI_PALETTES[theme]);
    return runs.map((run, i) => (
      <span key={i} style={{ color: run.color ?? undefined, fontWeight: run.bold ? 700 : undefined }}>
        {run.text}
      </span>
    ));
  }

  const kindColor: Record<SpanKind, string | undefined> = {
    plain: undefined,
    ok: colors.okFg,
    err: colors.errorFg,
    warn: colors.warnFg,
    dim: colors.mutedFg,
  };
  const lines = text.split('\n');
  return lines.map((line, li) => (
    <span key={li}>
      {highlightLine(line).map((span, si) => (
        <span key={si} style={{ color: kindColor[span.kind] }}>
          {span.text}
        </span>
      ))}
      {li < lines.length - 1 ? '\n' : ''}
    </span>
  ));
}
