/**
 * Regression screenshots: every scenario in regression/scenarios.ts, in every layout, for the working tree and
 * for `master` (origin/master, fetched first); then one comparison sheet per scenario and layout.
 *
 *   npm run regression                                # working tree + baselines
 *   npm run regression -- --assets <url> --jobs 8     # PR markdown with image links under <url>; 8 parallel tabs
 *
 * Output (git-ignored): regression-output/<version>/<scenario>-<layout>.png, manifest.json per version,
 * regression-output/compare/<scenario>-<layout>.png and regression-output/pr-regression.md.
 *
 * How it runs, fast:
 * - every version is built in development mode (so it opens without sign-in, like `npm run dev`) under its own
 *   path, and the builds are made in parallel;
 * - one static server on http://localhost:5173 (the port the local Google Maps key allows) serves them all, at
 *   /<version>/;
 * - every version × layout × scenario is captured in its own browser tab, several tabs at a time.
 * Without Firebase, places are kept in memory. The Maps key comes from .env.local. master's screenshots are cached
 * per commit.
 */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium, type Browser, type Page } from '@playwright/test';
import { LAYOUTS, NotApplicable, SCENARIOS, Ui, type Layout, type Scenario } from './scenarios.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'regression-output');
const BUILDS = join(OUT, '.builds');
const PORT = 5173;
const run = promisify(execFile);

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** The branch a PR is compared with, pinned to the commit it pointed to when the run started. */
interface Baseline {
  readonly ref: string;
  readonly commit: string;
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
  /** For the baseline: the commit the screenshots were taken from. */
  readonly commit?: string;
  readonly results: readonly Result[];
  readonly error?: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Only the Google Maps settings from .env.local; Firebase is blanked so every version opens without sign-in. */
function buildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
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

/**
 * Builds a version under /<label>/. A development-mode build keeps `import.meta.env.DEV`, so every version (old
 * releases included) opens the map without Firebase.
 */
async function build(v: Version): Promise<void> {
  if (v.baseline) {
    rmSync(v.dir, { recursive: true, force: true });
    git('worktree', 'add', '--detach', v.dir, v.baseline.commit);
    await run('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: v.dir });
  }
  const outDir = join(BUILDS, v.label);
  await run(
    'npx',
    ['vite', 'build', '--mode', 'development', '--base', `/${v.label}/`, '--outDir', outDir, '--emptyOutDir'],
    { cwd: v.dir, env: buildEnv(), maxBuffer: 64 * 1024 * 1024 },
  );
}

function removeWorktree(v: Version): void {
  if (!v.baseline) return;
  try {
    git('worktree', 'remove', '--force', v.dir);
  } catch {
    // already removed
  }
}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serves every build at /<label>/ (unknown paths fall back to the version's index.html). */
function serveBuilds(): Promise<Server> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(BUILDS, path));
    const version = path.split('/')[1] ?? '';
    if (!file.startsWith(BUILDS) || version === '') {
      res.writeHead(404).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(BUILDS, version, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => {
    server.listen(PORT, () => {
      ok(server);
    });
  });
}

/** Waits until the page has loaded what it needs: no network requests (map tiles, Google panels) for 500 ms. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  // One more frame for the map to paint the tiles it just received.
  await page.waitForTimeout(300);
}

/** One screenshot, in its own tab (a separate browser context, so the in-memory places don't leak between tabs). */
async function shoot(browser: Browser, v: Version, layout: Layout, scenario: Scenario): Promise<Result> {
  const file = join(OUT, v.label, `${scenario.id}-${layout.id}.png`);
  const context = await browser.newContext({
    viewport: { width: layout.width, height: layout.height },
    locale: 'he-IL',
  });
  try {
    const page = await context.newPage();
    await page.goto(`http://localhost:${String(PORT)}/${v.label}/`, { waitUntil: 'load' });
    await page.waitForSelector('#root > *', { timeout: 30000 });
    await settle(page);
    await scenario.run(new Ui(page, layout));
    await settle(page);
    await page.screenshot({ path: file });
    return { scenario: scenario.id, layout: layout.id, status: 'ok', note: '' };
  } catch (e) {
    if (existsSync(file)) rmSync(file);
    return {
      scenario: scenario.id,
      layout: layout.id,
      status: e instanceof NotApplicable ? 'n/a' : 'error',
      note: e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e),
    };
  } finally {
    await context.close();
  }
}

/** Runs the tasks with at most `limit` at a time. */
async function pool<T>(tasks: readonly (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      const task = tasks[i];
      if (task) results[i] = await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
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
  const baselines = versions.filter((v) => v.baseline).map((v) => `\`${v.title}\``);
  const sheets = LAYOUTS.flatMap((l) =>
    SCENARIOS.map((s) => `**${s.title} — ${l.title}**<br>${img(`compare/${s.id}-${l.id}.png`, 900)}`),
  );
  return [
    '## Regression',
    '',
    `**Differences from ${baselines.join(', ')}. Each one is expected, for the reason given:**`,
    '',
    '- <!-- every difference, in one list: what changed (scenario, layout) and why it is OK and expected -->',
    '',
    `Claude evaluated all regression images and comparison sheets against ${baselines.join(', ')}.`,
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
  const started = Date.now();
  const jobs = Math.max(1, Number(arg('--jobs') ?? 8));
  git('fetch', '--quiet', 'origin', 'master');
  const master: Baseline = { ref: 'origin/master', commit: git('rev-parse', 'origin/master') };
  const versions: Version[] = [
    { label: 'current', title: 'This PR', dir: ROOT, baseline: null },
    {
      label: 'master',
      title: `master @ ${master.commit.slice(0, 7)}`,
      dir: join(OUT, '.worktrees', 'master'),
      baseline: master,
    },
  ];

  // master's screenshots are reused while it points to the same commit.
  const cached = new Map<string, Manifest>();
  for (const v of versions) {
    const file = join(OUT, v.label, 'manifest.json');
    if (!v.baseline || !existsSync(file)) continue;
    const m = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
    if (m.commit === v.baseline.commit) cached.set(v.label, m);
  }
  const todo = versions.filter((v) => !cached.has(v.label));
  log(`versions: ${versions.map((v) => `${v.label}${cached.has(v.label) ? ' (cached)' : ''}`).join(', ')}`);

  const failed = new Map<string, string>();
  await Promise.all(
    todo.map(async (v) => {
      try {
        await build(v);
        log(`built ${v.label}`);
      } catch (e) {
        failed.set(v.label, e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e));
        log(`build failed ${v.label}: ${failed.get(v.label) ?? ''}`);
      } finally {
        removeWorktree(v);
      }
    }),
  );

  const server = await serveBuilds();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ready = todo.filter((v) => !failed.has(v.label));
    for (const v of ready) mkdirSync(join(OUT, v.label), { recursive: true });
    const tasks = ready.flatMap((v) =>
      LAYOUTS.flatMap((l) =>
        SCENARIOS.map((s) => async () => {
          const r = await shoot(browser, v, l, s);
          log(`  ${v.label} ${l.id} ${s.id}: ${r.status} ${r.note}`);
          return { label: v.label, result: r };
        }),
      ),
    );
    log(`capturing ${String(tasks.length)} screenshots, ${String(jobs)} tabs at a time`);
    const shots = await pool(tasks, jobs);

    const manifests = versions.map((v): Manifest => {
      const hit = cached.get(v.label);
      if (hit) return hit;
      const error = failed.get(v.label);
      const m: Manifest = {
        label: v.label,
        ...(v.baseline ? { commit: v.baseline.commit } : {}),
        results: shots.filter((x) => x.label === v.label).map((x) => x.result),
        ...(error === undefined ? {} : { error }),
      };
      mkdirSync(join(OUT, v.label), { recursive: true });
      writeFileSync(join(OUT, v.label, 'manifest.json'), JSON.stringify(m, null, 2));
      return m;
    });
    await compareSheets(browser, versions, manifests);
    const assets = arg('--assets');
    const current = manifests[0];
    if (assets !== null && current) {
      writeFileSync(join(OUT, 'pr-regression.md'), prMarkdown(assets.replace(/\/$/, ''), versions, current));
    }
  } finally {
    await browser.close();
    server.close();
  }
  log(`done in ${String(Math.round((Date.now() - started) / 1000))}s: ${OUT}`);
}

await main();
