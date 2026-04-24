#!/usr/bin/env bash
# Creates a single workspace-wide release tag on HEAD: `v<version>` taken
# from the root package.json. release-all.sh publishes every package at
# its current package.json version (which `pnpm bump` keeps unified), so
# one tag is enough — the workflow doesn't care which package a tag
# names, only that one was pushed.
#
# If `pnpm bump` left package.json files modified, those are committed as
# `v<version>` first so the tag points at the bump commit instead of the
# previous revision. Only package.json files are staged; any unrelated
# working-tree changes are left alone.
#
# Usage:
#   scripts/tag.sh          # create the tag locally only
#   scripts/tag.sh --push   # create and push to origin
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

PUSH=false
if [ "${1:-}" = "--push" ]; then
  PUSH=true
fi

VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v${VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG_NAME}" >/dev/null; then
  echo "exists ${TAG_NAME} (no new tag created)"
  exit 0
fi

PKG_FILES=(package.json packages/*/package.json)
if ! git diff --quiet HEAD -- "${PKG_FILES[@]}"; then
  echo "commit ${TAG_NAME} (uncommitted package.json bumps)"
  git add -- "${PKG_FILES[@]}"
  git commit -m "${TAG_NAME}"
fi

git tag "${TAG_NAME}"
echo "tag    ${TAG_NAME}"

if [ "$PUSH" = "true" ]; then
  echo ""
  echo "Pushing ${TAG_NAME} to origin..."
  git push origin "${TAG_NAME}"
fi
