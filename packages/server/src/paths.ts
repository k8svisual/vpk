import { dirname, join } from 'node:path';

/**
 * Directory holding shipped runtime assets (views, public/, sounds, textures…).
 *
 * Packaging constraint #1 (DESIGN §4.5, ROADMAP P0): in a `bun --compile` binary,
 * `import.meta`/`__dirname` resolve into a virtual filesystem, so any `fs`/view/static
 * read via `__dirname` throws ENOENT. Assets are shipped in a `resources/` folder next
 * to the executable and MUST be resolved from `process.execPath` when packaged.
 */
export function resourcesDir(devFallback?: string): string {
  if (isPackaged()) return join(dirname(process.execPath), 'resources');
  return devFallback ?? join(process.cwd(), 'resources');
}

/** Whether we're running as a compiled binary. Refined in the packaging phase (P7). */
export function isPackaged(): boolean {
  return process.env.VPK_PACKAGED === '1';
}
