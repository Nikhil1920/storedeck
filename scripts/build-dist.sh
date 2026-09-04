#!/bin/sh
# Build a minimal static-host bundle in ./dist/.
#
# Source of truth for the file list:
#   - index.html bottom <script> tags  -> language-utils.js, lucide-icons.js,
#     three-renderer.js, app.js, webmcp.js (+ styles.css via <link>)
#   - app.js runtime refs              -> img/info.svg (also in index.html),
#     img/laurel-*-left.svg (preloaded laurelImages)
#   - three-renderer.js model paths    -> models/*.glb
#   - Third-party libs (Three.js, JSZip) load from CDN, so nothing to bundle.
#
# NOT copied (not needed at runtime on a static host):
#   - img/icon.* (not referenced at runtime; favicon is an inline SVG data URI)
#   - img/screenshot-generator.png (README illustration only)
#   - Dockerfile, nginx.conf, docker-compose*, docs, node_modules, etc.
#
# Usage:  ./scripts/build-dist.sh   (or: npm run build)

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

# Static files served from the site root.
ROOT_FILES="index.html styles.css app.js language-utils.js lucide-icons.js three-renderer.js webmcp.js"
IMG_FILES="info.svg laurel-simple-left.svg laurel-detailed-left.svg"
MODEL_FILES="iphone-15-pro-max.glb samsung-galaxy-s25-ultra.glb"

# Fail early with a clear message if a required source file is missing.
for f in $ROOT_FILES; do
    [ -f "$ROOT/$f" ] || { echo "error: missing required file: $f" >&2; exit 1; }
done
for f in $IMG_FILES; do
    [ -f "$ROOT/img/$f" ] || { echo "error: missing required file: img/$f" >&2; exit 1; }
done
for f in $MODEL_FILES; do
    [ -f "$ROOT/models/$f" ] || { echo "error: missing required file: models/$f" >&2; exit 1; }
done

rm -rf "$DIST"
mkdir -p "$DIST/img" "$DIST/models"

for f in $ROOT_FILES; do
    cp "$ROOT/$f" "$DIST/$f"
done
for f in $IMG_FILES; do
    cp "$ROOT/img/$f" "$DIST/img/$f"
done
for f in $MODEL_FILES; do
    cp "$ROOT/models/$f" "$DIST/models/$f"
done

echo "dist/ created:"
# Portable listing (works on macOS and Linux).
(cd "$DIST" && find . -type f | sort)
du -sh "$DIST"
