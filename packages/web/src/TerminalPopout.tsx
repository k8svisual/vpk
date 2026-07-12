import { useEffect } from 'react';
import { TerminalPane } from './TerminalPane';
import { initialTerminalTheme } from './courseSettings';
import { initialTerminalFontSize } from './terminalFontSize';

/**
 * Rendered by main.tsx instead of <App /> when the URL has ?popout=terminal — the whole page IS the terminal,
 * no nav rail/header/lesson pane. `allow`/`cli` come from the URL (lesson-specific, not persisted anywhere
 * global) since LessonRunnerView.tsx's "Pop out Terminal" button builds that URL itself when opening this
 * window. Theme and font size deliberately do NOT come from the URL — they're read the exact same way the
 * embedded terminal reads them (initialTerminalTheme/initialTerminalFontSize, both localStorage-backed), which
 * works for free because localStorage is shared across same-origin windows; passing them through the URL too
 * would just be a second, staler source of truth for the same settings.
 *
 * The whole terminal session — input line, run transcript, and recall log — carries over both directions
 * (pop out AND back in) via localStorage; see TerminalPane.tsx's TerminalSession/getStoredSession/
 * setStoredSession. No BroadcastChannel or other live-sync channel needed: the embedded pane and this popout
 * are never mounted at the same time (one side always shows a placeholder instead), so "read once at mount,
 * write on every change" is sufficient — there's no simultaneous-edit case to reconcile.
 */
export function TerminalPopout() {
  const params = new URLSearchParams(window.location.search);
  const allow = (params.get('allow') ?? 'get').split(',').filter(Boolean);
  const cliParam = params.get('cli');
  const cli = cliParam ? cliParam.split(',').filter(Boolean) : undefined;
  // The lesson's delete-confirmation opt-out rides along in the URL like allow/cli (LessonRunnerView sets
  // confirmDelete=0 only when the lesson turned it off); absent means the default, confirm on.
  const confirmDelete = params.get('confirmDelete') !== '0';

  useEffect(() => {
    document.title = 'VpK Terminal';
  }, []);

  return (
    <div className="flex h-screen flex-col p-2" style={{ background: 'var(--vpk-bg)' }}>
      <TerminalPane allow={allow} cli={cli} confirmDelete={confirmDelete} theme={initialTerminalTheme()} fontSizePx={initialTerminalFontSize()} />
    </div>
  );
}
