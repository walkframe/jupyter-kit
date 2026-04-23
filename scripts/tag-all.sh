#!/usr/bin/env bash
# Creates v{version}/{package} tags on HEAD for every public workspace package.
# Existing tags are skipped. Private packages are skipped.
#
# Usage:
#   scripts/tag-all.sh          # create local tags only
#   scripts/tag-all.sh --push   # create and push to origin
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

PUSH=false
if [ "${1:-}" = "--push" ]; then
  PUSH=true
fi

CREATED=()

shopt -s nullglob
for pkg_dir in packages/*/; do
  pkg_dir="${pkg_dir%/}"
  [ -f "$pkg_dir/package.json" ] || continue

  NAME=$(node -p "require('./$pkg_dir/package.json').name")
  VERSION=$(node -p "require('./$pkg_dir/package.json').version")
  IS_PRIVATE=$(node -p "require('./$pkg_dir/package.json').private || false")

  if [ "$IS_PRIVATE" = "true" ]; then
    echo "skip   $NAME (private)"
    continue
  fi

  SHORT="${NAME##*/}"
  TAG_NAME="v${VERSION}/${SHORT}"

  if git rev-parse -q --verify "refs/tags/${TAG_NAME}" >/dev/null; then
    echo "exists ${TAG_NAME}"
    continue
  fi

  git tag "${TAG_NAME}"
  echo "tag    ${TAG_NAME}"
  CREATED+=("${TAG_NAME}")
done

if [ "$PUSH" = "true" ] && [ "${#CREATED[@]}" -gt 0 ]; then
  echo ""
  echo "Pushing ${#CREATED[@]} tag(s) to origin..."
  git push origin "${CREATED[@]}"
fi
