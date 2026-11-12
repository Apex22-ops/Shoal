#!/bin/bash
# Builds Shoal.app for macOS (Apple silicon and Intel) and zips it for a GitHub release.
# The app is signed ad hoc (no Apple Developer certificate): see "First launch" in the README.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
rm -rf dist
for ARCH in ${ARCHS:-arm64 x64}; do
  npx @electron/packager . Shoal --platform=darwin --arch="$ARCH" --out=dist \
    --icon=build/icon.icns --app-bundle-id=io.github.shoal --app-version="$VERSION" \
    --app-category-type=public.app-category.developer-tools \
    --ignore='^/(dist|scripts|docs|build|\.github)($|/)' --ignore='\.md$' --ignore='__pycache__' --prune=true --no-asar --overwrite
  APP="dist/Shoal-darwin-$ARCH/Shoal.app"
  # node-pty ships prebuilt binaries for every platform: keep only this one
  PB="$APP/Contents/Resources/app/node_modules/node-pty/prebuilds"
  find "$PB" -mindepth 1 -maxdepth 1 ! -name "darwin-$ARCH" -exec rm -rf {} +
  chmod +x "$PB/darwin-$ARCH/spawn-helper"
  codesign --force --deep --sign - "$APP"
  (cd "dist/Shoal-darwin-$ARCH" && ditto -c -k --keepParent Shoal.app "../Shoal-$VERSION-mac-$ARCH.zip")
  echo "→ dist/Shoal-$VERSION-mac-$ARCH.zip"
done
