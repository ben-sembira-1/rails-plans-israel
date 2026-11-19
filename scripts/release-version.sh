#!/usr/bin/env bash
# Computes the next semantic version for a push to master.
# - Finds the PR that was merged into HEAD and reads its version:* label.
# - Bumps the latest vX.Y.Z tag (v0.0.0 if none) and creates the new tag locally.
# - On workflow_dispatch (or a push without a labelled PR) it re-uses the current version.
# Outputs (GITHUB_OUTPUT): version, created=true|false
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
latest=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || echo 'v0.0.0')
IFS=. read -r major minor patch <<< "${latest#v}"

if git tag --points-at HEAD | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "HEAD is already tagged ${latest}"
  { echo "version=${latest}"; echo "created=false"; } >> "${out}"
  exit 0
fi

label=""
if [ "${EVENT:-push}" = "push" ]; then
  label=$(gh api "repos/${GITHUB_REPOSITORY}/commits/$(git rev-parse HEAD)/pulls" \
    --jq '[.[] | select(.merged_at != null) | .labels[].name | select(startswith("version:"))][0] // ""')
fi

case "${label}" in
  version:major) next="v$((major + 1)).0.0" ;;
  version:minor) next="v${major}.$((minor + 1)).0" ;;
  version:patch) next="v${major}.${minor}.$((patch + 1))" ;;
  *)
    echo "No version label found (event: ${EVENT:-push}); keeping ${latest}"
    { echo "version=${latest}"; echo "created=false"; } >> "${out}"
    exit 0
    ;;
esac

echo "Bumping ${latest} -> ${next} (${label})"
git tag "${next}"
{ echo "version=${next}"; echo "created=true"; } >> "${out}"
