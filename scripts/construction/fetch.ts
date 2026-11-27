/**
 * Fetches today's construction snapshot from every city source and writes data/construction.json.
 *
 *   npm run construction:fetch -- <out.json> [--previous <url-or-file>]
 *
 * Run once a day by .github/workflows/construction-data.yml; nothing else calls the city APIs. With --previous,
 * the run fails (and nothing is deployed) when a source returns no records or less than half of what the previous
 * snapshot had, so a broken API never wipes the map.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  parseConstruction,
  type ConstructionData,
  type ConstructionSource,
} from '../../src/data/construction.ts';
import { quarterOf } from '../../src/domain/construction.ts';
import { buildTelAviv, fetchTelAviv } from './sources/telAviv.ts';

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

async function readPrevious(src: string): Promise<ConstructionData | null> {
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(60_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return parseConstruction(await res.json());
    }
    return existsSync(src) ? parseConstruction(JSON.parse(readFileSync(src, 'utf8'))) : null;
  } catch (e) {
    log(`previous snapshot unreadable (${e instanceof Error ? e.message : String(e)}); no comparison`);
    return null;
  }
}

/** Problems that should stop the deploy, comparing each source with the previous snapshot. */
export function sanityProblems(
  sources: readonly ConstructionSource[],
  previous: readonly ConstructionSource[] | null,
): string[] {
  const problems: string[] = [];
  for (const s of sources) {
    if (s.count === 0) problems.push(`${s.city} / ${s.name}: no records`);
    const before = previous?.find((p) => p.url === s.url);
    if (before && s.count < before.count / 2) {
      problems.push(`${s.city} / ${s.name}: ${String(s.count)} records, was ${String(before.count)}`);
    }
  }
  return problems;
}

async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out || out.startsWith('--')) throw new Error('usage: fetch.ts <out.json> [--previous <url-or-file>]');
  const prevSrc = arg('--previous');
  const previous = prevSrc ? await readPrevious(prevSrc) : null;

  const now = new Date();
  const snapshot = quarterOf(now);
  log('Tel Aviv-Yafo…');
  const tlv = await fetchTelAviv({ log });
  const projects = buildTelAviv(tlv.raw, snapshot, now);

  const problems = sanityProblems(tlv.sources, previous?.sources ?? null);
  if (problems.length > 0) throw new Error(`sanity check failed:\n  ${problems.join('\n  ')}`);

  // Validate exactly what the app will read.
  const data = parseConstruction({ fetchedAt: now.toISOString(), snapshot, sources: tlv.sources, projects });
  mkdirSync(dirname(out), { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(out, json);
  for (const s of data.sources) log(`${s.city} / ${s.name}: ${String(s.count)} records`);
  log(`${String(data.projects.length)} projects, ${(json.length / 1e6).toFixed(1)} MB -> ${out}`);
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
