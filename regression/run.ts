/**
 * Regression screenshots: every scenario in regression/scenarios.ts, in every layout, for the working tree and
 * for the baseline releases picked by regression/refs.ts; then one comparison sheet per scenario and layout.
 *
 *   npm run regression                      # working tree + baselines
 *   npm run regression -- --assets <url>    # also write the PR markdown with image links under <url>
 *
 * Output (git-ignored): regression-output/<version>/<scenario>-<layout>.png, manifest.json per version,
 * regression-output/compare/<scenario>-<layout>.png and regression-output/pr-regression.md.
 *
 * Every version runs as a local dev server on http://localhost:5173 (the port the local Google Maps key allows),
 * without Firebase, so places are kept in memory. The Maps key comes from .env.local.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { pickBaselines, type Baseline } from './refs.ts';
import { LAYOUTS, NotApplicable, SCENARIOS, Ui } from './scenarios.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'regression-output');
const PORT = 5173;

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

interface Version {
  readonly label: string;
  readonly title: string;
  readonly dir: string;
  readonly baseline: Baseline | null;
}

interface Result {
  readonly scenario: string;
  readonly layout: string;
  readonly status: 'ok' | 'n/a' | 'error';
  readonly note: string;
}

interface Manifest {
  readonly label: string;
  readonly results: readonly Result[];
  readonly error?: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** Only the Google Maps settings from .env.local; Firebase is blanked so every version opens without sign-in. */
function serverEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VITE_FIREBASE_API_KEY: '',
    VITE_FIREBASE_AUTH_DOMAIN: '',
    VITE_FIREBASE_PROJECT_ID: '',
    VITE_FIREBASE_APP_ID: '',
    VITE_GOOGLE_CLIENT_ID: '',
  };
  const file = join(ROOT, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^(VITE_GOOGLE_MAPS_API_KEY|VITE_GOOGLE_MAP_ID)=(.*)$/.exec(line.trim());
      if (m?.[1] !== undefined) env[m[1]] = m[2] ?? '';
    }
  }
  return env;
}

async function portFree(): Promise<boolean> {
  try {
    await fetch(`http://localhost:${String(PORT)}/`, { signal: AbortSignal.timeout(1000) });
    return false;
  } catch {
    return true;
  }
}

/** Starts the version's dev server and resolves with the app URL. */
async function startServer(dir: string): Promise<{ server: ChildProcess; url: string }> {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: dir,
    env: serverEnv(),
    stdio: 'ignore',
    detached: true,
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const path of ['/rails-plans-israel/', '/']) {
      try {
        const res = await fetch(`http://localhost:${String(PORT)}${path}`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) return { server, url: `http://localhost:${String(PORT)}${path}` };
      } catch {
        // not up yet
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(server);
  throw new Error('the dev server did not start');
}

function stopServer(server: ChildProcess): void {
  if (server.pid !== undefined) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

async function capture(browser: Browser, url: string, outDir: string): Promise<Result[]> {
  mkdirSync(outDir, { recursive: true });
  const results: Result[] = [];
  for (const layout of LAYOUTS) {
    for (const scenario of SCENARIOS) {
      const context = await browser.newContext({
        viewport: { width: layout.width, height: layout.height },
        locale: 'he-IL',
      });
      const page = await context.newPage();
      const file = join(outDir, `${scenario.id}-${layout.id}.png`);
      try {
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForSelector('#root > *', { timeout: 20000 });
        await page.waitForTimeout(3500);
        await scenario.run(new Ui(page, layout));
        // Let the map redraw at its new size (panels change its width) and load the tiles.
        await page.waitForTimeout(4000);
        await page.screenshot({ path: file });
        results.push({ scenario: scenario.id, layout: layout.id, status: 'ok', note: '' });
      } catch (e) {
        const na = e instanceof NotApplicable;
        if (existsSync(file)) rmSync(file);
        results.push({
          scenario: scenario.id,
          layout: layout.id,
          status: na ? 'n/a' : 'error',
          note: e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e),
        });
      } finally {
        await context.close();
      }
      const last = results[results.length - 1];
      log(`  ${layout.id} ${scenario.id}: ${last?.status ?? '?'} ${last?.note ?? ''}`);
    }
  }
  return results;
}

async function runVersion(browser: Browser, v: Version): Promise<Manifest> {
  const outDir = join(OUT, v.label);
  const manifestFile = join(outDir, 'manifest.json');
  // Releases never change, so their screenshots are reused.
  if (v.baseline && existsSync(manifestFile)) {
    log(`${v.label}: cached`);
    return JSON.parse(readFileSync(manifestFile, 'utf8')) as Manifest;
  }
  log(`${v.label}: ${v.title}`);
  let manifest: Manifest;
  try {
    if (v.baseline) {
      rmSync(v.dir, { recursive: true, force: true });
      git('worktree', 'add', '--detach', v.dir, v.baseline.tag);
      execFileSync('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], {
        cwd: v.dir,
        stdio: 'ignore',
      });
    }
    const { server, url } = await startServer(v.dir);
    try {
      manifest = { label: v.label, results: await capture(browser, url, outDir) };
    } finally {
      stopServer(server);
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (e) {
    manifest = { label: v.label, results: [], error: e instanceof Error ? e.message : String(e) };
    log(`  failed: ${manifest.error ?? ''}`);
  } finally {
    if (v.baseline) {
      try {
        git('worktree', 'remove', '--force', v.dir);
      } catch {
        // already removed
      }
    }
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  return manifest;
}

function cell(m: Manifest, scenario: string, layout: string): string {
  const r = m.results.find((x) => x.scenario === scenario && x.layout === layout);
  if (r?.status === 'ok') {
    const png = readFileSync(join(OUT, m.label, `${scenario}-${layout}.png`)).toString('base64');
    return `<img src="data:image/png;base64,${png}">`;
  }
  const text = m.error ?? (r ? `${r.status}: ${r.note}` : 'missing');
  return `<div class="na">${text.replace(/[<&]/g, '')}</div>`;
}

/** One sheet per scenario and layout: the working tree next to each baseline. */
async function compareSheets(browser: Browser, versions: readonly Version[], manifests: Manifest[]) {
  const dir = join(OUT, 'compare');
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 600 } });
  for (const layout of LAYOUTS) {
    const width = layout.id === 'desktop' ? 440 : 230;
    for (const scenario of SCENARIOS) {
      const cols = versions
        .map(
          (v, i) =>
            `<figure><figcaption>${v.label}<br><small>${v.title}</small></figcaption>${cell(manifests[i] ?? { label: v.label, results: [] }, scenario.id, layout.id)}</figure>`,
        )
        .join('');
      await page.setContent(
        `<html><body style="margin:0;font:14px sans-serif;background:#fff">
          <h3 style="margin:8px 12px">${scenario.title} — ${layout.title}</h3>
          <div style="display:flex;gap:12px;padding:0 12px 12px">${cols}</div>
          <style>figure{margin:0;width:${String(width)}px}figcaption{font-weight:600;margin-bottom:4px}
          img{width:100%;border:1px solid #ccc}.na{border:1px dashed #bbb;color:#777;padding:24px 8px;
          height:${String(Math.round((width * layout.height) / layout.width))}px;box-sizing:border-box}</style>
        </body></html>`,
      );
      await page.screenshot({ path: join(dir, `${scenario.id}-${layout.id}.png`), fullPage: true });
    }
  }
  await page.close();
}

function prMarkdown(assets: string, versions: readonly Version[], current: Manifest): string {
  const img = (file: string, width: number) =>
    `<a href="${assets}/${file}"><img src="${assets}/${file}" width="${String(width)}"></a>`;
  const rows = SCENARIOS.map((s) => {
    const cells = LAYOUTS.map((l) => {
      const r = current.results.find((x) => x.scenario === s.id && x.layout === l.id);
      return r?.status === 'ok'
        ? img(`${s.id}-${l.id}.png`, l.id === 'desktop' ? 240 : 110)
        : (r?.status ?? '?');
    });
    return `| ${s.title} | ${cells.join(' | ')} |`;
  });
  const baselines = versions
    .filter((v) => v.baseline)
    .map((v) => `\`${v.label}\` (${v.title.toLowerCase()})`);
  const sheets = LAYOUTS.flatMap((l) =>
    SCENARIOS.map((s) => `**${s.title} — ${l.title}**<br>${img(`compare/${s.id}-${l.id}.png`, 900)}`),
  );
  return [
    '## Regression',
    '',
    `Compared with ${baselines.join(', ')}.`,
    '',
    '<!-- EVALUATION: Claude writes its evaluation here before marking the PR ready. -->',
    '',
    '| Scenario | Desktop | Phone |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '<details><summary>Side-by-side comparison sheets</summary>',
    '',
    ...sheets.flatMap((x) => [x, '']),
    '</details>',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  if (!(await portFree())) throw new Error(`port ${String(PORT)} is in use; stop the dev server first`);
  const tags = git('tag', '--merged', 'HEAD', '--format=%(refname:short) %(creatordate:iso-strict)')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name = '', date = ''] = line.split(' ');
      return { name, date: new Date(date) };
    });
  const baselines = pickBaselines(tags, new Date());
  const versions: Version[] = [
    { label: 'current', title: 'This PR', dir: ROOT, baseline: null },
    ...baselines.map((b) => ({
      label: b.tag,
      title: b.title,
      dir: join(OUT, '.worktrees', b.tag),
      baseline: b,
    })),
  ];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const manifests: Manifest[] = [];
    for (const v of versions) manifests.push(await runVersion(browser, v));
    await compareSheets(browser, versions, manifests);
    const assets = arg('--assets');
    const current = manifests[0];
    if (assets !== null && current) {
      writeFileSync(join(OUT, 'pr-regression.md'), prMarkdown(assets.replace(/\/$/, ''), versions, current));
    }
  } finally {
    await browser.close();
  }
  log(`done: ${OUT}`);
}

await main();
