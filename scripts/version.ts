/**
 * Release version helper.
 *
 *   node scripts/version.ts check                    – fail unless package.json's version is above the latest tag
 *   node scripts/version.ts current                  – print package.json's version
 *   node scripts/version.ts target patch|minor|major – print the version this PR should have: the higher of
 *                                                      origin/master's version and the latest vX.Y.Z tag, bumped
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export type Semver = readonly [number, number, number];

export function parseSemver(v: string): Semver | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (m === null) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

export function latestVersion(tags: readonly string[]): Semver | null {
  return tags
    .map(parseSemver)
    .filter((v): v is Semver => v !== null)
    .reduce<Semver | null>((best, v) => (best === null || compareSemver(v, best) > 0 ? v : best), null);
}

export type BumpLevel = 'patch' | 'minor' | 'major';

export function isBumpLevel(s: string | undefined): s is BumpLevel {
  return s === 'patch' || s === 'minor' || s === 'major';
}

export function bumpSemver([major, minor, patch]: Semver, level: BumpLevel): Semver {
  if (level === 'major') return [major + 1, 0, 0];
  if (level === 'minor') return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

/** The version a PR should have: the newest of master's version and the latest release tag, bumped by `level`. */
export function targetVersion(master: Semver | null, latestTag: Semver | null, level: BumpLevel): Semver {
  const candidates = [master, latestTag].filter((v): v is Semver => v !== null);
  const base = candidates.reduce<Semver>((best, v) => (compareSemver(v, best) > 0 ? v : best), [0, 0, 0]);
  return bumpSemver(base, level);
}

function masterVersion(): Semver | null {
  try {
    const raw = execFileSync('git', ['show', 'origin/master:package.json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseSemver((JSON.parse(raw) as { version: string }).version);
  } catch {
    return null;
  }
}

function releaseTags(): string[] {
  return execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n');
}

export function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

function main(cmd: string | undefined, level: string | undefined): number {
  const current = packageVersion();
  if (cmd === 'current') {
    process.stdout.write(`${current}\n`);
    return 0;
  }
  if (cmd === 'target') {
    if (!isBumpLevel(level)) {
      console.error('usage: node scripts/version.ts target patch|minor|major');
      return 2;
    }
    process.stdout.write(
      `${targetVersion(masterVersion(), latestVersion(releaseTags()), level).join('.')}\n`,
    );
    return 0;
  }
  if (cmd !== 'check') {
    console.error('usage: node scripts/version.ts check|current|target <level>');
    return 2;
  }
  const parsed = parseSemver(current);
  if (parsed === null) {
    console.error(`package.json version "${current}" is not X.Y.Z`);
    return 1;
  }
  const latest = latestVersion(releaseTags());
  if (latest !== null && compareSemver(parsed, latest) <= 0) {
    console.error(
      `package.json version ${current} must be bumped above the latest release v${latest.join('.')}. ` +
        'Run `npm version patch|minor|major --no-git-tag-version`.',
    );
    return 1;
  }
  console.warn(`OK: ${current} > ${latest === null ? 'no release yet' : `v${latest.join('.')}`}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  process.exitCode = main(process.argv[2], process.argv[3]);
}
