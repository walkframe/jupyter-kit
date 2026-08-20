#!/usr/bin/env bash
# Publishes every public workspace package at its current version, plus the
# generated theme-* packages under packages/theme/dist-publish/.
#   - private packages are skipped
#   - pre-release versions (version contains '-') go to npm dist-tag "next"
#   - already-published versions fail on npm and are silently skipped
#
# Theme CSS is rebuilt up-front so packages/theme/dist-publish/theme-*/ is
# always in sync with the current source. The script is self-contained:
# the release workflow and local invocations both go through this single
# entry point.
set -uo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

# Names of packages whose publish genuinely failed (i.e. not an
# already-published skip). Collected so the script can exit non-zero at the
# end instead of masking a broken release as green.
FAILED_PKGS=()

# Always rebuild theme so dist-publish/theme-*/ reflects the current
# packages/theme/less/ source. Cheap (less + esbuild minify, ~1s) and
# guarantees a release never ships stale CSS.
echo "::group::build @jupyter-kit/theme (regenerates dist-publish/theme-*)"
pnpm --filter @jupyter-kit/theme run build
echo "::endgroup::"

publish_dir() {
  local dir="$1"
  [ -f "$dir/package.json" ] || return 0

  local NAME VERSION IS_PRIVATE TAG
  NAME=$(node -p "require('./$dir/package.json').name")
  VERSION=$(node -p "require('./$dir/package.json').version")
  IS_PRIVATE=$(node -p "require('./$dir/package.json').private || false")

  if [ "$IS_PRIVATE" = "true" ]; then
    echo "::group::skip $NAME (private)"
    echo "::endgroup::"
    return 0
  fi

  TAG=""
  if [[ "$VERSION" == *-* ]]; then
    TAG="--tag next"
  fi

  echo "::group::publish $NAME@$VERSION $TAG"
  local OUT STATUS
  # Capture combined output so we can tell an already-published version (safe
  # to skip) apart from a genuine failure (must fail the release).
  OUT=$(cd "$dir" && pnpm publish --access public $TAG --no-git-checks --provenance 2>&1)
  STATUS=$?
  echo "$OUT"
  if [ "$STATUS" -ne 0 ]; then
    # npm returns EPUBLISHCONFLICT / 403 "cannot publish over the previously
    # published versions" when the version already exists — that's an expected
    # idempotent skip, not a failure.
    if echo "$OUT" | grep -qiE 'EPUBLISHCONFLICT|cannot publish over|previously published|403 Forbidden.*over'; then
      echo "  -> skipped (already published)"
    else
      echo "  -> FAILED to publish $NAME@$VERSION"
      FAILED_PKGS+=("$NAME@$VERSION")
    fi
  fi
  echo "::endgroup::"
}

shopt -s nullglob

# Workspace packages.
for pkg_dir in packages/*/; do
  publish_dir "${pkg_dir%/}"
done

# Generated theme-* packages.
for theme_dir in packages/theme/dist-publish/theme-*/; do
  publish_dir "${theme_dir%/}"
done

if [ "${#FAILED_PKGS[@]}" -gt 0 ]; then
  echo "::error::release failed for ${#FAILED_PKGS[@]} package(s): ${FAILED_PKGS[*]}"
  exit 1
fi

echo "release complete."
