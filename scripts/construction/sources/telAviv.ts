/**
 * Tel Aviv-Yafo: building permits (layer 772), construction sites (499) and road works (852) from the city's GIS
 * server. See docs/CONSTRUCTION.md for the field mapping.
 */
import type {
  ConstructionSource,
  Project,
  ProjectPhase,
  ProjectStatus,
} from '../../../src/data/construction.ts';
import type { LatLng } from '../../../src/data/validate.ts';
import { quarterAfter, quarterOf } from '../../../src/domain/construction.ts';
import { TIMELINE_START } from '../../../src/domain/time.ts';
import { queryAll, type ClientOptions, type Feature } from '../arcgis.ts';
import { lines, representativePoint, rings } from '../geometry.ts';

export const SERVER = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer';
const CITY = 'tel-aviv';

export const LAYERS = {
  permits: { id: 772, name: 'בקשות והיתרי בניה', orderBy: 'oid_permit' },
  sites: { id: 499, name: 'אתרי בניה', orderBy: 'oid_site' },
  roads: { id: 852, name: 'עבודות כבישים', orderBy: 'OBJECTID' },
} as const;

/** Only the fields we use (the permit holders' names are never requested). */
export const FIELDS = {
  permits: [
    'request_num',
    'permission_date',
    'permission_num',
    'expiry_date',
    'open_request',
    'url_hadmaya',
    'sw_tama_38',
    'sug_bakasha',
    'finished',
    'occupation',
    'tr_hathalat_bniya',
    'building_stage',
    'yechidot_diyur',
    'addresses',
  ],
  sites: [
    'tik_tipul',
    'heterim',
    'matzav_bniya',
    'tr_tchilat_avoda',
    'sug_bakasha',
    'ktovet',
    'ishurei_laila',
  ],
  roads: [
    'GlobalID',
    't_ktovet',
    'mahut_avoda',
    'tzimtzum_netivim',
    'sivug_yom_layla',
    'date_start',
    'date_end',
  ],
} as const;

export interface RawLayers {
  readonly permits: readonly Feature[];
  readonly sites: readonly Feature[];
  readonly roads: readonly Feature[];
}

/** Request types that make construction noise; changes, use permits and the short track are left out. */
const NOISY = /^(בניה חדשה|תוספות בניה|ציבורי|תעסוקה)/;
const FINISHED_STAGES = new Set(['קיימת לפחות תעודת גמר אחת', 'קיים אכלוס']);
const UNDER_CONSTRUCTION = 'בבניה';
/** Typical works durations, used when no end date is published. */
const NEW_BUILDING_YEARS = 3;
const OTHER_YEARS = 2;

// ---- field readers -------------------------------------------------------------------------------------------

function text(f: Feature, key: string): string {
  const v = f.properties[key];
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}
function int(f: Feature, key: string): number | null {
  const v = f.properties[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
/** Epoch milliseconds -> Date. */
function epoch(f: Feature, key: string): Date | null {
  const v = int(f, key);
  return v === null || v <= 0 ? null : new Date(v);
}
/** The latest `dd/mm/yyyy` in a field (some fields list several dates). */
export function latestDmy(s: string): Date | null {
  let best: Date | null = null;
  for (const m of s.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    if (!Number.isNaN(d.getTime()) && (best === null || d > best)) best = d;
  }
  return best;
}
function dmy(f: Feature, key: string): Date | null {
  return latestDmy(text(f, key));
}
function https(s: string): string | undefined {
  return s.startsWith('https://') ? s : undefined;
}

/** "בניה חדשה בניין … , בניה חדשה מרתפים" or "בניה חדשה/בניין … ,תוספות בניה/הריסה" -> up to three parts. */
export function requestTitle(s: string): string {
  const parts = s
    .split(/\s*,\s*/)
    .map((p) => p.replace('/', ' – ').trim())
    .filter((p) => p !== '');
  return [...new Set(parts)].slice(0, 3).join(' · ');
}

/** Phases from (time, status) pairs: sorted, one per quarter (the later status wins). */
function phases(points: readonly (readonly [number | null, ProjectStatus])[]): ProjectPhase[] {
  const out: ProjectPhase[] = [];
  for (const [since, status] of points) {
    if (since === null) continue;
    const last = out[out.length - 1];
    // Never go back in time: a later step that is dated earlier happens together with the previous one.
    const t = last ? Math.max(since, last.since) : since;
    if (t === last?.since) out[out.length - 1] = { since: t, status };
    else out.push({ since: t, status });
  }
  return out;
}

function shapeAndPoint(features: readonly Feature[]): { shapes: LatLng[][]; position: LatLng } | null {
  const shapes = features.flatMap((f) => rings(f.geometry));
  const position = representativePoint(shapes, true);
  return position === null ? null : { shapes, position };
}

function endOfWorks(start: number, title: string, snapshot: number): number {
  const years = title.includes('בניה חדשה') ? NEW_BUILDING_YEARS : OTHER_YEARS;
  return Math.max(start + years, snapshot + 0.25);
}

/** The permit numbers a site lists in `heterim` ("20220951 ,20260532"). */
function sitePermits(site: Feature): number[] {
  return text(site, 'heterim')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// ---- projects ------------------------------------------------------------------------------------------------

function buildingProject(
  rows: readonly Feature[],
  site: Feature | null,
  snapshot: number,
  now: Date,
): Project | null {
  const r = rows[0];
  if (!r) return null;
  const title = requestTitle(text(r, 'sug_bakasha'));
  if (!NOISY.test(title)) return null;
  const stage = text(r, 'building_stage');
  const requested = epoch(r, 'open_request');
  const permitted = epoch(r, 'permission_date');
  const expiry = epoch(r, 'expiry_date');

  // Start and finish dates belong to the building, so only those after this request's permit count.
  let start: Date | null = null;
  if (site) start = epoch(site, 'tr_tchilat_avoda');
  else {
    const s = epoch(r, 'tr_hathalat_bniya');
    if (s && permitted && s >= permitted) start = s;
    else if (stage === UNDER_CONSTRUCTION && permitted) start = permitted;
  }
  let finish: Date | null = null;
  if (!site) {
    const after = start ?? permitted;
    for (const d of [dmy(r, 'finished'), dmy(r, 'occupation')]) {
      if (d && after && d >= after) {
        finish = d;
        break;
      }
    }
    // Finished, but we can't tell when: it can't be placed on the timeline.
    if (FINISHED_STAGES.has(stage) && finish === null) return null;
  }

  const ph = phases([
    [requested && quarterOf(requested), 'requested'],
    [permitted && quarterOf(permitted), 'permitted'],
    [start && quarterOf(start), 'construction'],
  ]);
  const last = ph[ph.length - 1];
  if (!last) return null;

  let until: number | null = null;
  let untilEstimated = false;
  if (finish) until = quarterAfter(finish);
  else if (last.status === 'construction') {
    until = endOfWorks(last.since, title, snapshot);
    untilEstimated = true;
  } else if (last.status === 'permitted') {
    // A permit that expired before works started is dropped; otherwise it waits until it expires.
    if (expiry && expiry < now) return null;
    if (expiry) until = quarterAfter(expiry);
  }
  if (until !== null && until <= last.since) until = last.since + 0.25;
  if (until !== null && until <= TIMELINE_START) return null;

  const geo = shapeAndPoint(site ? [site] : rows);
  if (!geo) return null;
  const units = int(r, 'yechidot_diyur');
  const link = https(text(r, 'url_hadmaya'));
  const address = text(r, 'addresses') || (site ? text(site, 'ktovet') : '');
  return {
    id: `tlv-permit-${String(int(r, 'request_num'))}`,
    city: CITY,
    kind: 'building',
    title,
    address: address || 'תל אביב–יפו',
    position: geo.position,
    shapes: geo.shapes,
    phases: ph,
    until,
    ...(untilEstimated ? { untilEstimated } : {}),
    ...(site && text(site, 'matzav_bniya') ? { stage: text(site, 'matzav_bniya') } : {}),
    ...(units !== null && units > 0 ? { units } : {}),
    ...(text(r, 'sw_tama_38') === 'כן' ? { tama38: true } : {}),
    ...(site && text(site, 'ishurei_laila') ? { nightWorks: true } : {}),
    ...(link ? { link } : {}),
  };
}

/** A construction site with no permit in the permits layer. */
function siteProject(site: Feature, snapshot: number): Project | null {
  const title = requestTitle(text(site, 'sug_bakasha')) || 'אתר בנייה';
  const start = epoch(site, 'tr_tchilat_avoda');
  const since = start ? quarterOf(start) : snapshot;
  const geo = shapeAndPoint([site]);
  const id = text(site, 'tik_tipul');
  if (!geo || !id) return null;
  return {
    id: `tlv-site-${id}`,
    city: CITY,
    kind: 'building',
    title,
    address: text(site, 'ktovet') || 'תל אביב–יפו',
    position: geo.position,
    shapes: geo.shapes,
    phases: [{ since, status: 'construction' }],
    until: endOfWorks(since, title, snapshot),
    untilEstimated: true,
    ...(text(site, 'matzav_bniya') ? { stage: text(site, 'matzav_bniya') } : {}),
    ...(text(site, 'ishurei_laila') ? { nightWorks: true } : {}),
  };
}

function roadProject(f: Feature): Project | null {
  const start = dmy(f, 'date_start');
  const end = dmy(f, 'date_end');
  if (!start || !end || end < start) return null;
  const since = quarterOf(start);
  const until = Math.max(quarterAfter(end), since + 0.25);
  if (until <= TIMELINE_START) return null;
  const shapes = lines(f.geometry);
  const position = representativePoint(shapes, false);
  const id = text(f, 'GlobalID').replace(/[{}]/g, '').toLowerCase();
  if (!position || !id) return null;
  const traffic = [text(f, 'tzimtzum_netivim'), text(f, 'sivug_yom_layla')].filter((s) => s && s !== 'אחר');
  return {
    id: `tlv-road-${id}`,
    city: CITY,
    kind: 'road',
    title: text(f, 'mahut_avoda') || 'עבודות כביש',
    address: text(f, 't_ktovet') || 'תל אביב–יפו',
    position,
    shapes,
    phases: [{ since, status: 'construction' }],
    until,
    ...(traffic.length > 0 ? { traffic: traffic.join(' · ') } : {}),
  };
}

/** Normalizes the three layers into projects. Pure, so it is tested with recorded responses. */
export function buildTelAviv(raw: RawLayers, snapshot: number, now: Date): Project[] {
  // One request can have several rows (one per building polygon).
  const byRequest = new Map<number, Feature[]>();
  const byPermit = new Map<number, number>();
  for (const f of raw.permits) {
    const req = int(f, 'request_num');
    if (req === null) continue;
    const list = byRequest.get(req);
    if (list) list.push(f);
    else byRequest.set(req, [f]);
    const permit = int(f, 'permission_num');
    if (permit !== null && permit > 0) byPermit.set(permit, req);
  }

  // A site lists all the permits of its building file; it belongs to the latest noisy one, and the others are the
  // same works (or older ones), so they are left out.
  const siteOf = new Map<number, Feature>();
  const skip = new Set<number>();
  const orphanSites: Feature[] = [];
  for (const site of raw.sites) {
    const reqs = sitePermits(site)
      .map((p) => byPermit.get(p))
      .filter((r): r is number => r !== undefined)
      .filter((r) => NOISY.test(requestTitle(text(byRequest.get(r)?.[0] ?? site, 'sug_bakasha'))));
    if (reqs.length === 0) {
      orphanSites.push(site);
      continue;
    }
    const latest = Math.max(...reqs);
    siteOf.set(latest, site);
    for (const r of reqs) if (r !== latest) skip.add(r);
  }

  const projects: Project[] = [];
  for (const [req, rows] of byRequest) {
    if (skip.has(req)) continue;
    const p = buildingProject(rows, siteOf.get(req) ?? null, snapshot, now);
    if (p) projects.push(p);
  }
  for (const s of orphanSites) {
    const p = siteProject(s, snapshot);
    if (p) projects.push(p);
  }
  for (const f of raw.roads) {
    const p = roadProject(f);
    if (p) projects.push(p);
  }
  // Ids must be unique; a duplicate site file number keeps its first entry.
  const seen = new Set<string>();
  return projects.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export async function fetchTelAviv(
  opts: ClientOptions,
): Promise<{ raw: RawLayers; sources: ConstructionSource[] }> {
  const get = (layer: (typeof LAYERS)[keyof typeof LAYERS], fields: readonly string[]) =>
    queryAll(`${SERVER}/${String(layer.id)}`, { outFields: fields, orderBy: layer.orderBy }, opts);
  // One layer after the other: never more than one request at a time.
  const permits = await get(LAYERS.permits, FIELDS.permits);
  const sites = await get(LAYERS.sites, FIELDS.sites);
  const roads = await get(LAYERS.roads, FIELDS.roads);
  const source = (layer: (typeof LAYERS)[keyof typeof LAYERS], count: number): ConstructionSource => ({
    city: CITY,
    name: layer.name,
    url: `${SERVER}/${String(layer.id)}`,
    count,
  });
  return {
    raw: { permits, sites, roads },
    sources: [
      source(LAYERS.permits, permits.length),
      source(LAYERS.sites, sites.length),
      source(LAYERS.roads, roads.length),
    ],
  };
}
