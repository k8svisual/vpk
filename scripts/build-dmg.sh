#!/bin/bash
#
# Build a local macOS binary for VpK and package it into a .dmg you can drag
# out and run directly. VpK isn't a Tauri app (see scripts/release.sh's own
# doc comment) — there's no Xcode project here, just the standalone
# `bun build --compile` binary (web app embedded) wrapped in a minimal, hand-
# built VpK.app bundle (Info.plist + build/icon.icns from scripts/build-icons.sh)
# so Finder/Launchpad/the Dock show VpK's actual icon instead of a generic
# Unix-executable one — built locally for your own machine's architecture.
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
OUT_DIR="$REPO_ROOT/dist-dmg"
mkdir -p "$OUT_DIR"

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

echo "==> Embedding seed course content into the server bundle"
bun run build:course-assets

echo "==> Compiling $BUN_TARGET"
bun scripts/build-binary.ts "$BUN_TARGET"

# webAssets.generated.ts/courseAssets.generated.ts are only ever meant to hold real content transiently, right
# before a compile (see their own header comments) — restore the committed empty placeholders so this script
# doesn't leave your working tree dirty every time you run it locally.
git checkout -- packages/server/src/webAssets.generated.ts packages/server/src/courseAssets.generated.ts

echo "==> Building icons (scripts/build-icons.sh)"
./scripts/build-icons.sh

echo "==> Assembling VpK.app"
STAGING_DIR="$(mktemp -d)"
APP_DIR="$STAGING_DIR/VpK.app"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "dist-bin/$OUT_NAME" "$APP_DIR/Contents/MacOS/vpk"
chmod +x "$APP_DIR/Contents/MacOS/vpk"
cp build/icon.icns "$APP_DIR/Contents/Resources/AppIcon.icns"
cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>VpK</string>
  <key>CFBundleDisplayName</key><string>VpK</string>
  <key>CFBundleIdentifier</key><string>com.k8svisual.vpk</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>vpk</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
# Finder/LaunchServices cache an app's icon by its Info.plist + Resources signature — touch forces this
# freshly-assembled bundle to be treated as new rather than reusing a stale cached icon from a same-named app
# built earlier (harmless if there was never a prior one; -f so a first run on a fresh machine doesn't error).
touch -f "$APP_DIR"

echo "==> Packaging into $DMG_NAME"
rm -f "$OUT_DIR/$DMG_NAME"
hdiutil create -volname "VpK $VERSION" -srcfolder "$STAGING_DIR" -ov -format UDZO "$OUT_DIR/$DMG_NAME"
rm -rf "$STAGING_DIR"

echo ""
echo "✅ Built $OUT_DIR/$DMG_NAME"
echo "   Mount it, drag VpK.app to Applications (or anywhere), then open it like any other app — double-click,"
echo "   or right-click > Open the first time to get past Gatekeeper (it's unsigned). It opens a local server"
echo "   and auto-opens your browser at the right port."
