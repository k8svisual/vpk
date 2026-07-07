import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, initialTheme } from './theme';
import './index.css';

// Applied before the first render (not inside App) so there's no flash of the wrong theme — index.html
// ships with data-theme="light" as a static fallback; this immediately corrects it from localStorage/system
// preference before React even mounts.
applyTheme(initialTheme());

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
