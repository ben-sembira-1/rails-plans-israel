#!/usr/bin/env bash
# Fails if any staged file under references/raw/ is not an LFS pointer.
set -euo pipefail

status=0
while IFS= read -r -d '' file; do
  if ! git show ":${file}" 2>/dev/null | head -c 200 | grep -q '^version https://git-lfs.github.com/spec/v1'; then
    echo "not stored in LFS: ${file}" >&2
    status=1
  fi
done < <(git diff --cached --name-only --diff-filter=AM -z -- references/raw/)
exit "${status}"
