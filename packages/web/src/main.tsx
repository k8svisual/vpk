import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, initialTheme } from './theme';
import { applyFontSize, initialFontSize } from './fontSize';
import { applyKindColorOverrides, getStoredKindColorOverrides } from './kindColorOverrides';
import './index.css';

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

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
