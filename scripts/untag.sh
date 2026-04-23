#!/usr/bin/env bash
# Removes every tag pointing at HEAD. Lists them first for safety.
#
# Usage:
#   scripts/untag-all.sh           # delete local tags on HEAD
#   scripts/untag-all.sh --remote  # also delete matching tags from origin
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

REMOTE=false
if [ "${1:-}" = "--remote" ]; then
  REMOTE=true
fi

HEAD_SHA=$(git rev-parse HEAD)
mapfile -t TAGS < <(git tag --points-at "$HEAD_SHA")

if [ "${#TAGS[@]}" -eq 0 ]; then
  echo "No tags at HEAD ($HEAD_SHA)"
  exit 0
fi

echo "Tags at HEAD ($HEAD_SHA):"
printf '  %s\n' "${TAGS[@]}"
echo ""

for tag in "${TAGS[@]}"; do
  git tag -d "$tag"
done

if [ "$REMOTE" = "true" ]; then
  echo ""
  echo "Deleting from origin..."
  # batch delete in one push
  REFS=()
  for tag in "${TAGS[@]}"; do
    REFS+=(":refs/tags/${tag}")
  done
  git push origin "${REFS[@]}" || true
fi
