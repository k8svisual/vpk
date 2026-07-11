export type TerminalTheme = 'dark' | 'light';

const CLI_OVERRIDE_KEY = 'vpk-course-cli-override';
const TERMINAL_THEME_KEY = 'vpk-terminal-theme';

/** Overrides which kubectl-compatible CLI the in-app terminal (and DetectCard/CheckCard) run, REGARDLESS of
 *  what a lesson's own frontmatter `cli` says — e.g. a student who only has `oc` installed can set this once
 *  in Settings instead of hitting "Only 'kubectl' commands are allowed here" on every kubectl-authored lesson.
 *  Empty string means "no override, use the lesson's own `cli`" (the previous, only behavior). Same
 *  localStorage-only display-preference model as theme/fontSize — this doesn't relax WHICH VERBS are
 *  allowed (checkCommandPolicy's `allow` gate is unaffected), only which binary name is required, and oc is
 *  a documented superset of kubectl for every verb these lessons use. */
export function initialCliOverride(): string {
  try {
    return localStorage.getItem(CLI_OVERRIDE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredCliOverride(cli: string): void {
  try {
    if (cli.trim()) localStorage.setItem(CLI_OVERRIDE_KEY, cli.trim());
    else localStorage.removeItem(CLI_OVERRIDE_KEY);
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}

/** The in-app terminal's black-bg/white-fg vs white-bg/black-fg display, moved here from an in-terminal
 *  toggle button (Settings is where every other display preference in this app already lives — theme,
 *  fontSize, fog, grid — so a course-specific one belongs alongside them, not as a one-off button clutting
 *  the terminal's own cramped header). */
export function initialTerminalTheme(): TerminalTheme {
  try {
    return localStorage.getItem(TERMINAL_THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setStoredTerminalTheme(theme: TerminalTheme): void {
  try {
    localStorage.setItem(TERMINAL_THEME_KEY, theme);
  } catch {
    // best-effort
  }
}

export type CourseLayout = 'row' | 'column';

const LAYOUT_KEY = 'vpk-course-layout';

/** Side-by-side (lesson left, terminal right — the default) vs stacked (lesson above, terminal below, for a
 *  wider terminal on a narrow window). Toggled via a button in the terminal's own banner line — unlike
 *  theme/fontSize/cliOverride above, this is a workspace layout action the student reaches for in the
 *  moment, not a background preference, so it stays as an in-terminal button rather than moving to Settings;
 *  it's still persisted here so the choice survives a reload. */
export function initialCourseLayout(): CourseLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'column' ? 'column' : 'row';
  } catch {
    return 'row';
  }
}

export function setStoredCourseLayout(layout: CourseLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // best-effort
  }
}
