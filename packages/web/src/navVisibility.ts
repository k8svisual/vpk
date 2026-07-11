const CATALOG_KEY = 'vpk-show-course-catalog';
const TEACHER_KEY = 'vpk-show-teacher-tools';

function getBool(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : raw === 'true';
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts
  }
}

function setBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}

/** Whether the "Catalog" (course picker) and "Teacher" (course create/edit) nav items show up in the
 *  Training group — same localStorage-only display-preference model as theme/fontSize/fog/grid. Both default
 *  ON so the new features are discoverable; Settings > UI is where they get turned off. */
export function initialShowCourseCatalog(): boolean {
  return getBool(CATALOG_KEY) ?? true;
}
export function setStoredShowCourseCatalog(v: boolean): void {
  setBool(CATALOG_KEY, v);
}

export function initialShowTeacherTools(): boolean {
  return getBool(TEACHER_KEY) ?? true;
}
export function setStoredShowTeacherTools(v: boolean): void {
  setBool(TEACHER_KEY, v);
}
