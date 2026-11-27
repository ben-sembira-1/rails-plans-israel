/** Picks the earlier releases a PR's regression screenshots are compared with. */

export interface Tag {
  readonly name: string;
  readonly date: Date;
}

export interface Baseline {
  readonly role: 'latest' | 'previous-minor' | 'week-ago';
  readonly title: string;
  readonly tag: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parse(name: string): [number, number, number] | null {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(name);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * - latest: the highest `vX.Y.Z` tag;
 * - previous-minor: the highest tag of an earlier minor (or major) line than the latest;
 * - week-ago: the most recent tag created at least 7 days before `now`, if any.
 */
export function pickBaselines(tags: readonly Tag[], now: Date): Baseline[] {
  const releases = tags
    .flatMap((t) => {
      const v = parse(t.name);
      return v ? [{ ...t, v }] : [];
    })
    .sort((a, b) => compare(b.v, a.v));
  const latest = releases[0];
  if (!latest) return [];
  const out: Baseline[] = [{ role: 'latest', title: 'Latest release', tag: latest.name }];

  const previousMinor = releases.find((r) => compare([r.v[0], r.v[1], 0], [latest.v[0], latest.v[1], 0]) < 0);
  if (previousMinor) {
    out.push({ role: 'previous-minor', title: 'Previous minor version', tag: previousMinor.name });
  }

  const weekAgo = releases
    .filter((r) => now.getTime() - r.date.getTime() >= WEEK_MS)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  if (weekAgo) out.push({ role: 'week-ago', title: 'Release from a week ago', tag: weekAgo.name });
  return out;
}
