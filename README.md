# VpK — rebuild (v2)

Clean-rewrite monorepo. Design: [`../redesign/DESIGN.md`](../redesign/DESIGN.md) ·
Roadmap: [`../redesign/ROADMAP.md`](../redesign/ROADMAP.md). The legacy app (`../src`, `../dist`) stays as the
reference oracle.

## Packages
- `@vpk/core` — pure domain: `ResourceGraph`, ingest/normalize, parsers, projections. No I/O, no DOM.
- `@vpk/server` — thin host: capture (`CliSource`), snapshot sources, projection API, per-session state.
- `@vpk/web` — React client (left-rail shell, 3D, views).

## Runtime & tooling
- **Bun** (runs TS natively; ships via `bun --compile`). Node also runs the TS via type-stripping.
- Typecheck: `bun run typecheck` · Test: `bun run test` · Lint: `bun run lint` · Format: `bun run format`.

## Packaging constraints (baked in — see ROADMAP P0)
1. Resolve runtime asset paths from the executable (`resourcesDir()` in `@vpk/server`), not `__dirname` — a
   compiled binary's `__dirname` points into a virtual FS. Ship a `resources/` folder next to the binary.
2. No dynamic `require(variable)` — bundlers can't see it.
