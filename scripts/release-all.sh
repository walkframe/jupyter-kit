#!/usr/bin/env bash
# Publishes every public workspace package at its current version.
#   - private packages are skipped
#   - pre-release versions (version contains '-') go to npm dist-tag "next"
#   - already-published versions fail on npm and are silently skipped
#
# Intended to be called from the release workflow, but also usable locally
# if you have the appropriate npm auth configured.
set -uo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

shopt -s nullglob
for pkg_dir in packages/*/; do
  pkg_dir="${pkg_dir%/}"
  [ -f "$pkg_dir/package.json" ] || continue

  NAME=$(node -p "require('./$pkg_dir/package.json').name")
  VERSION=$(node -p "require('./$pkg_dir/package.json').version")
  IS_PRIVATE=$(node -p "require('./$pkg_dir/package.json').private || false")

  if [ "$IS_PRIVATE" = "true" ]; then
    echo "::group::skip $NAME (private)"
    echo "::endgroup::"
    continue
  fi

  TAG=""
  if [[ "$VERSION" == *-* ]]; then
    TAG="--tag next"
  fi

  echo "::group::publish $NAME@$VERSION $TAG"
  (cd "$pkg_dir" && pnpm publish --access public --provenance $TAG --no-git-checks) \
    || echo "  -> skipped (already published or publish failed)"
  echo "::endgroup::"
done
