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
    const result = spawnSync('bun', ['build', '--compile', `--target=${target.bunTarget}`, `--outfile=${outfile}`, ENTRY], {
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.error(`✗ Build failed for ${target.bunTarget}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log(`\n✅ Built ${targets.length} binar${targets.length === 1 ? 'y' : 'ies'} in dist-bin/`);
}

main();
