import { execFileSync } from 'node:child_process'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Runs `git describe` with the given tag pattern; returns undefined when no tag matches. */
function describeTag(pattern: string): string | undefined {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', pattern], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

function shortSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

const REFERENCE_TAG_PREFIX = 'reference-update-'

const appVersion = process.env['APP_VERSION'] ?? describeTag('v[0-9]*') ?? `dev-${shortSha()}`
const referenceTag = describeTag(`${REFERENCE_TAG_PREFIX}*`)
const referenceDate = referenceTag?.slice(REFERENCE_TAG_PREFIX.length) ?? 'unknown'

export default defineConfig({
  base: process.env['VITE_BASE'] ?? '/rails-plans-israel/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __REFERENCE_DATE__: JSON.stringify(referenceDate),
    __GIT_SHA__: JSON.stringify(shortSha()),
  },
})
