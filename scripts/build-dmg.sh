#!/bin/bash
#
# Build a local macOS binary for VpK and package it into a .dmg you can drag
# out and run directly. VpK isn't a Tauri app (see scripts/release.sh's own
# doc comment) — there's no .app bundle here, just the standalone
# `bun build --compile` binary (web app embedded) inside a disk image, same
# artifact the release workflow produces for macOS, built locally for your
# own machine's architecture.
#
# Usage (from repo root):
#   ./scripts/build-dmg.sh
#
# Prerequisites: bun (this repo's whole toolchain). hdiutil ships with macOS.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  BUN_TARGET="bun-darwin-arm64"
  OUT_NAME="vpk-macos-arm64"
elif [ "$ARCH" = "x86_64" ]; then
  BUN_TARGET="bun-darwin-x64"
  OUT_NAME="vpk-macos-x64"
else
  echo "❌ Unrecognized architecture '$ARCH' — expected arm64 or x86_64."
  exit 1
fi

VERSION="$(node -e "console.log(require('./package.json').version)")"
DMG_NAME="vpk-${VERSION}-${ARCH}.dmg"

echo "▶ Building VpK v$VERSION for $ARCH ($BUN_TARGET)"
echo ""

echo "==> Installing dependencies"
bun install

echo "==> Typecheck + tests (same gate the release workflow runs)"
bun run typecheck
bun run test

echo "==> Building the web app"
bun run build:web

echo "==> Embedding the web app into the server bundle"
bun run build:web-assets

echo "==> Compiling $BUN_TARGET"
bun scripts/build-binary.ts "$BUN_TARGET"

# webAssets.generated.ts is only ever meant to hold real content transiently, right before a compile (see its
# own header comment) — restore the committed empty placeholder so this script doesn't leave your working tree
# dirty every time you run it locally.
git checkout -- packages/server/src/webAssets.generated.ts

echo "==> Packaging into $DMG_NAME"
STAGING_DIR="$(mktemp -d)"
cp "dist-bin/$OUT_NAME" "$STAGING_DIR/"
chmod +x "$STAGING_DIR/$OUT_NAME"
rm -f "$DMG_NAME"
hdiutil create -volname "VpK $VERSION" -srcfolder "$STAGING_DIR" -ov -format UDZO "$DMG_NAME"
rm -rf "$STAGING_DIR"

echo ""
echo "✅ Built $REPO_ROOT/$DMG_NAME"
echo "   Mount it, drag out '$OUT_NAME', then run it directly (Terminal, or double-click and approve the"
echo "   Gatekeeper prompt — it's unsigned). It opens a local server and prints the URL to open in your browser."
