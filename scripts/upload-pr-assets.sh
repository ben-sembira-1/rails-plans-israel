#!/usr/bin/env bash
# Uploads the regression screenshots to the pr-assets branch (Git LFS) under pr-<n>/regression/, replacing any
# earlier upload for that PR. Never force-pushes.
#
#   scripts/upload-pr-assets.sh <pr-number>
#
# The images are then at
#   https://media.githubusercontent.com/media/ben-sembira-1/rails-plans-israel/pr-assets/pr-<n>/regression/<file>
set -euo pipefail

pr="${1:?usage: scripts/upload-pr-assets.sh <pr-number>}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "PR number must be numeric: $pr" >&2; exit 2; }

root="$(git rev-parse --show-toplevel)"
out="$root/regression-output"
[ -d "$out/current" ] && [ -d "$out/compare" ] || { echo "Run npm run regression first" >&2; exit 1; }

worktree="$(mktemp -d)/pr-assets"
cleanup() { git -C "$root" worktree remove --force "$worktree" 2>/dev/null || true; }
trap cleanup EXIT

git -C "$root" fetch --quiet origin pr-assets
git -C "$root" worktree add --quiet --detach "$worktree" origin/pr-assets
cd "$worktree"
git lfs install --local --skip-smudge > /dev/null

dest="pr-$pr/regression"
rm -rf "$dest"
mkdir -p "$dest/compare"
cp "$out"/current/*.png "$dest/"
cp "$out"/compare/*.png "$dest/compare/"
git add -A "pr-$pr"

if git diff --cached --quiet; then
  echo "pr-assets already has these images"
  exit 0
fi
git -c user.name="${GIT_AUTHOR_NAME:-github-actions[bot]}" \
  -c user.email="${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}" \
  commit --quiet --no-verify -m "PR #$pr regression screenshots"
git push --quiet origin HEAD:pr-assets
echo "Uploaded $(git show --stat --format= HEAD | tail -1) to pr-assets/$dest"
