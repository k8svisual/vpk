import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TerminalPopout } from './TerminalPopout';
import { ClusterViewPopout } from './ClusterViewPopout';
import { applyTheme, initialTheme } from './theme';
import { applyFontSize, initialFontSize } from './fontSize';
import { applyKindColorOverrides, getStoredKindColorOverrides } from './kindColorOverrides';
import { reportClientError } from './reportClientError';
import './index.css';

// ErrorBoundary.tsx only catches errors React itself throws during render/commit — an exception inside an
// event handler (onClick, etc.) or an unawaited rejected promise anywhere in the app never reaches it at all,
// so those need their own top-level net to end up in the same server-side log buffer.
window.addEventListener('error', (e) => reportClientError('window.onerror', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => reportClientError('unhandled promise rejection', e.reason));

// Applied before the first render (not inside App) so there's no flash of the wrong theme — index.html
// ships with data-theme="light" as a static fallback; this immediately corrects it from localStorage/system
// preference before React even mounts.
applyTheme(initialTheme());
// Same reasoning for font size — sets <html>'s font-size before first paint so there's no flash of default
// (100%) sizing before snapping to a stored preference.
applyFontSize(initialFontSize());
// Same reasoning for per-kind color overrides — sets the --vpk-kind-<kind> custom properties any
// server-rendered SVG (already embedding var(--vpk-kind-<kind>, <default>)) picks up the instant it's inlined.
applyKindColorOverrides(getStoredKindColorOverrides());

// LessonRunnerView.tsx's "Pop out Terminal" button opens a new window at this same URL (just this query
// param added) rather than a different route — same bundle, same index.html, so the popup window gets the
// exact CSS/theme the main window has for free, none of the stylesheet-cloning a raw `window.open('', ...)` +
// cross-document portal would need.
const popout = new URLSearchParams(window.location.search).get('popout');

const el = document.getElementById('root');
if (el) createRoot(el).render(popout === 'terminal' ? <TerminalPopout /> : popout === 'clusterview' ? <ClusterViewPopout /> : <App />);
