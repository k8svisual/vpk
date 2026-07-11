import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cross-compiles the server (with the built web app embedded via webAssets.generated.ts — run
 * `build:web` + `build:web-assets` first) into standalone Bun executables. `bun build --compile` can produce
 * a binary for a DIFFERENT platform than the one it's running on (it downloads that platform's Bun runtime
 * once, then links against it) — confirmed working for darwin/linux/windows cross-compiles from a single
 * machine, which is why the release workflow only needs one runner instead of Retirement Planner's per-OS
 * matrix (that project's Tauri/Rust build genuinely can't cross-compile the same way).
 *
 * Usage:
 *   bun scripts/build-binary.ts                  # every target below
 *   bun scripts/build-binary.ts bun-darwin-arm64  # just one (for a quick local smoke test)
 */

interface Target {
  bunTarget: string;
  outName: string;
}

const TARGETS: Target[] = [
  { bunTarget: 'bun-darwin-arm64', outName: 'vpk-macos-arm64' },
  { bunTarget: 'bun-darwin-x64', outName: 'vpk-macos-x64' },
  { bunTarget: 'bun-linux-x64', outName: 'vpk-linux-x64' },
  { bunTarget: 'bun-linux-arm64', outName: 'vpk-linux-arm64' },
  { bunTarget: 'bun-windows-x64', outName: 'vpk-windows-x64.exe' },
];

const here = import.meta.dir;
const ENTRY = join(here, '../packages/server/src/server.ts');
const OUT_DIR = join(here, '../dist-bin');
// scripts/build-icons.sh's output — Bun embeds this directly into the .exe's resources (no bundle/wrapper
// needed the way macOS's Finder-visible icon requires one, see build-dmg.sh's .app step).
//
// CAVEAT: Bun rejects --windows-icon outright ("only available when compiling on Windows") when the HOST
// isn't Windows — confirmed by actually running this cross-compile from macOS. That's true for every other
// --windows-* flag too. So on the single-runner cross-compile setup this repo uses (see this file's own
// module doc comment), the icon can't be embedded today; it only would be if this ever ran ON a Windows
// runner for that one target, or a separate PE resource-editing step (e.g. resedit-js, which is pure JS and
// doesn't need Wine/an actual Windows host) post-processed dist-bin/vpk-windows-x64.exe afterward. Neither is
// wired up — this just skips the flag with a warning so cross-compiling the other 4 targets still works.
const WINDOWS_ICON = join(here, '../build/icon.ico');

function main() {
  const requested = process.argv[2];
  const targets = requested ? TARGETS.filter((t) => t.bunTarget === requested) : TARGETS;
  if (requested && targets.length === 0) {
    console.error(`Unknown target "${requested}". Known targets: ${TARGETS.map((t) => t.bunTarget).join(', ')}`);
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  for (const target of targets) {
    const outfile = join(OUT_DIR, target.outName);
    console.log(`\n▶ ${target.bunTarget} → dist-bin/${target.outName}`);
    const args = ['build', '--compile', `--target=${target.bunTarget}`, `--outfile=${outfile}`];
    if (target.bunTarget === 'bun-windows-x64' && existsSync(WINDOWS_ICON)) {
      if (process.platform === 'win32') {
        args.push(`--windows-icon=${WINDOWS_ICON}`, '--windows-title=VpK', '--windows-publisher=VpK');
      } else {
        console.log('  ⚠ Skipping --windows-icon — only supported when compiling on an actual Windows host (see WINDOWS_ICON doc comment above).');
      }
    }
    args.push(ENTRY);
    const result = spawnSync('bun', args, { stdio: 'inherit' });
    if (result.status !== 0) {
      console.error(`✗ Build failed for ${target.bunTarget}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log(`\n✅ Built ${targets.length} binar${targets.length === 1 ? 'y' : 'ies'} in dist-bin/`);
}

main();
