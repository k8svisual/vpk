#!/bin/bash
#
# Regenerate VpK's app icons — macOS .icns, Windows .ico, a Linux hicolor-theme PNG set, and the browser
# favicon — from the single source-of-truth packages/web/public/vpk.svg (the same badge as VpkIcon.tsx, just
# with fixed text metrics instead of that component's runtime bbox-measuring trick, which is irrelevant for a
# static raster export).
#
# Outputs are written to build/ (consumed by build-binary.ts / build-dmg.sh) and packages/web/public/
# (favicon.ico + apple-touch-icon.png, consumed by index.html) and checked into git — small, binary, no need
# for rsvg-convert/imagemagick at compile or page-load time. Re-run this only when vpk.svg itself changes.
#
# Usage (from repo root):
#   ./scripts/build-icons.sh
#
# Prerequisites: rsvg-convert (librsvg) + imagemagick (`magick`). Both via Homebrew on macOS. The .icns step
# additionally needs `iconutil`, which only exists on macOS — it's skipped with a warning everywhere else,
# since that format is macOS-only anyway (Windows/Linux CI can still produce icon.ico + icons/ fine).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SRC="packages/web/public/vpk.svg"
OUT="build"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT/icons"

# Renders the SVG (preserving its own ~1.024 aspect ratio, NOT stretched to square) so it fills ~84% of a
# transparent SIZExSIZE canvas, centered — matching the margin every other app icon on macOS/Windows leaves,
# so VpK doesn't look cramped/cut-off next to them in a Dock or Start Menu.
render() {
  local size="$1" out="$2"
  local inner=$((size * 84 / 100))
  rsvg-convert -w "$inner" -h "$inner" "$SRC" -o "$TMP/render.png"
  magick "$TMP/render.png" -background none -gravity center -extent "${size}x${size}" "$out"
}

echo "▶ Generating icons from $SRC"

# --- macOS .icns ---
if command -v iconutil >/dev/null 2>&1; then
  ICONSET="$TMP/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for spec in "16:icon_16x16" "32:icon_16x16@2x" "32:icon_32x32" "64:icon_32x32@2x" \
              "128:icon_128x128" "256:icon_128x128@2x" "256:icon_256x256" "512:icon_256x256@2x" \
              "512:icon_512x512" "1024:icon_512x512@2x"; do
    size="${spec%%:*}"; name="${spec##*:}"
    render "$size" "$ICONSET/$name.png"
  done
  iconutil -c icns "$ICONSET" -o "$OUT/icon.icns"
  echo "  ✓ $OUT/icon.icns"
else
  echo "  ⚠ iconutil not found (macOS-only) — skipping .icns"
fi

# --- Windows .ico — multi-resolution, embedded directly by build-binary.ts's --windows-icon flag ---
ICO_PNGS=()
for size in 16 24 32 48 64 128 256; do
  p="$TMP/ico_${size}.png"
  render "$size" "$p"
  ICO_PNGS+=("$p")
done
magick "${ICO_PNGS[@]}" "$OUT/icon.ico"
echo "  ✓ $OUT/icon.ico"

# --- Linux — freedesktop hicolor icon theme sizes. There's no single-binary icon embedding on Linux (unlike
#     Windows' --windows-icon); this set is what a .desktop launcher's Icon= key or an AppImage's .DirIcon
#     would reference once this repo has a Linux packaging step — see build-dmg.sh's macOS .app bundle for the
#     analogous "wrap the raw binary so the OS actually shows an icon" idea, not yet done for Linux. ---
for size in 16 22 24 32 48 64 128 256 512; do
  render "$size" "$OUT/icons/${size}x${size}.png"
done
cp "$SRC" "$OUT/icons/scalable.svg"
echo "  ✓ $OUT/icons/ (hicolor PNG set + scalable.svg)"

# --- Browser favicon — written straight into packages/web/public/ (Vite serves that directory's contents at
#     the site root as-is) rather than build/, since these are consumed by index.html's <link> tags, not by
#     the compile scripts above. favicon.svg isn't generated here — $SRC (public/vpk.svg) already lives in the
#     right place and is linked directly, so there's no duplicate copy to fall out of sync. .ico still matters
#     for browsers/contexts that don't support SVG favicons (older Safari, browser tab-switcher UIs, etc.);
#     apple-touch-icon.png is what iOS uses for a home-screen/bookmark icon, which never accepts SVG or .ico.
WEB_PUBLIC="packages/web/public"
ICO_PNGS=()
for size in 16 32 48; do
  p="$TMP/favicon_${size}.png"
  render "$size" "$p"
  ICO_PNGS+=("$p")
done
magick "${ICO_PNGS[@]}" "$WEB_PUBLIC/favicon.ico"
render 180 "$WEB_PUBLIC/apple-touch-icon.png"
echo "  ✓ $WEB_PUBLIC/favicon.ico + apple-touch-icon.png (favicon.svg is $SRC itself, linked directly)"

echo ""
echo "✅ Icons written to $OUT/ and $WEB_PUBLIC/"
