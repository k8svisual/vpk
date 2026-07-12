import { useEffect } from 'react';
import { CourseGraphicPanel, type GraphicView } from './CourseGraphicPanel';

/**
 * Rendered by main.tsx instead of <App /> when the URL has ?popout=graphic — the whole page IS the course
 * graphic panel, no nav rail/header/lesson. `cli` comes from the URL (lesson-specific), the same way
 * TerminalPopout takes allow/cli. No session needs to cross windows here: the isolated capture lives on the
 * SERVER (course/graphic.ts), so this window and the embedded panel both read the same `/course/graphic/state`
 * — popping out and back in just re-reads server state, nothing to sync client-side.
 *
 * Auto-refresh-on-task (the embedded panel's `refreshSignal`) deliberately isn't wired through the URL: while
 * popped out, the student drives refreshes with the panel's own Refresh button, matching how the popped-out
 * terminal is self-contained too.
 */
export function GraphicPopout() {
  const params = new URLSearchParams(window.location.search);
  const cliParam = params.get('cli');
  const cli = cliParam ? cliParam.split(',').filter(Boolean) : undefined;
  const defaultView: GraphicView = params.get('view') === 'wheel' ? 'wheel' : 'schematic';

  useEffect(() => {
    document.title = 'VpK — Your cluster';
  }, []);

  return (
    <div className="h-screen p-2" style={{ background: 'var(--vpk-bg)' }}>
      <CourseGraphicPanel cli={cli} defaultView={defaultView} />
    </div>
  );
}
