#!/bin/bash
#
# Release helper — bumps the version, commits, tags, and pushes. The new tag
# triggers the GitHub Actions release workflow, which cross-compiles
# standalone binaries for macOS, Linux, and Windows (with the built web app
# embedded — no separate install step) and attaches them to a draft GitHub
# Release.
#
# Usage:
#   ./scripts/release.sh 1.0.2
#
# What it does (in order):
#   1.  Validates the version argument is a clean semver (X.Y.Z).
#   2.  Confirms working tree is clean (no uncommitted changes).
#   3.  Updates the version in package.json (the single source of truth —
#       unlike Retirement Planner's three files, VpK has no Tauri/Cargo
#       config carrying a duplicate copy).
#   4.  Commits the bump with message "Bump version to X.Y.Z".
#   5.  Pushes the current branch.
#   6.  Creates and pushes the git tag vX.Y.Z, which triggers the release
#       workflow on GitHub.
#
# If anything fails mid-way, you can re-run after fixing the underlying
# issue — the script is idempotent for an already-updated package.json.

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <version>     (e.g. $0 1.0.2)"
  exit 1
fi

VERSION="$1"

# ---- 1. Validate semver -----------------------------------------------------
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Version '$VERSION' must be a clean semver like 1.2.3 (no leading 'v', no suffixes)."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PKG_JSON=package.json

if [ ! -f "$PKG_JSON" ]; then
  echo "❌ Expected file '$PKG_JSON' not found. Run from a clean repo checkout."
  exit 1
fi

# ---- 2. Working tree clean? -------------------------------------------------
if ! git diff-index --quiet HEAD --; then
  echo "❌ Working tree has uncommitted changes. Commit or stash before releasing."
  git status --short
  exit 1
fi

echo "▶ Releasing v$VERSION"
echo ""

# ---- 3. Update package.json --------------------------------------------------
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PKG_JSON', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('$PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  ✓ $PKG_JSON → $VERSION"

# ---- 4. Commit --------------------------------------------------------------
git add "$PKG_JSON"
git commit -m "Bump version to $VERSION"
echo ""
echo "  ✓ Committed version bump"

# ---- 5. Push current branch -------------------------------------------------
git push origin HEAD
echo "  ✓ Pushed current branch"

# ---- 6. Tag and push the tag ------------------------------------------------
TAG="v$VERSION"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo ""
  echo "⚠  Tag $TAG already exists locally. Delete it first if you want to retag:"
  echo "    git tag -d $TAG && git push origin --delete $TAG"
  exit 1
fi

git tag "$TAG"
git push origin "$TAG"
echo "  ✓ Tagged and pushed $TAG"
echo ""
echo "✅ Release $TAG kicked off. Watch the build:"
echo "   https://github.com/k8svisual/vpk/actions"
echo ""
echo "When it finishes, find the draft release here:"
echo "   https://github.com/k8svisual/vpk/releases"
