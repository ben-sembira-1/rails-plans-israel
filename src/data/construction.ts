import { validators, type LatLng } from './validate.ts';

/**
 * City construction projects (building permits and sites, road works), fetched once a day from the cities' GIS
 * servers by scripts/construction/fetch.ts and served next to the site as data/construction.json.
 */

export const PROJECT_KINDS = ['building', 'road'] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

/** `requested` = permit requested; `permitted` = permit issued, works not started; `construction` = works. */
export const PROJECT_STATUSES = ['requested', 'permitted', 'construction'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectPhase {
  /** Decimal year (quarter start) the phase starts. */
  readonly since: number;
  readonly status: ProjectStatus;
}

export interface Project {
  /** e.g. `tlv-permit-20191382`, `tlv-site-63-1-2014-0153`, `tlv-road-c286c66c`. */
  readonly id: string;
  readonly city: string;
  readonly kind: ProjectKind;
  /** What is built (request type, or the kind of road works). */
  readonly title: string;
  readonly address: string;
  /** A point inside the project, for the dot at low zoom and the card. */
  readonly position: LatLng;
  /** Building: the site's outline rings. Road: the works' paths. */
  readonly shapes: readonly (readonly LatLng[])[];
  /** Ordered by `since`, strictly increasing. */
  readonly phases: readonly ProjectPhase[];
  /** Decimal year the works end (the project disappears); `null` = no end (a request or permit that waits). */
  readonly until: number | null;
  /** `until` is our estimate (a typical duration), not a published date. */
  readonly untilEstimated?: boolean;
  /** Construction stage reported by the city (e.g. "עבודות עפר וביסוס"). */
  readonly stage?: string;
  readonly units?: number;
  readonly tama38?: boolean;
  readonly nightWorks?: boolean;
  /** Road works: lane closure and day/night description. */
  readonly traffic?: string;
  /** The city's page for the file (archive, simulation or works notice). */
  readonly link?: string;
}

export interface ConstructionSource {
  readonly city: string;
  readonly name: string;
  readonly url: string;
  readonly count: number;
}

export interface ConstructionData {
  /** ISO time the data was fetched. */
  readonly fetchedAt: string;
  /** Decimal year (quarter) of the fetch: statuses after it are projections. */
  readonly snapshot: number;
  readonly sources: readonly ConstructionSource[];
  readonly projects: readonly Project[];
}

const { fail, obj, arr, str, num, bool, latLng, path, optional, unique } = validators('construction.json');

function oneOf<T extends string>(values: readonly T[], v: unknown, p: string): T {
  const found = values.find((x) => x === v);
  return found ?? fail(p, `one of ${values.join(', ')}`);
}

function httpsLink(v: unknown, p: string): string {
  const s = str(v, p);
  if (!s.startsWith('https://')) fail(p, 'an https link');
  return s;
}

function project(v: unknown, p: string): Project {
  const o = obj(v, p);
  const kind = oneOf(PROJECT_KINDS, o['kind'], `${p}.kind`);
  const phases = arr(o['phases'], `${p}.phases`).map((x, i): ProjectPhase => {
    const ph = obj(x, `${p}.phases[${i}]`);
    return {
      since: num(ph['since'], `${p}.phases[${i}].since`),
      status: oneOf(PROJECT_STATUSES, ph['status'], `${p}.phases[${i}].status`),
    };
  });
  if (phases.length === 0) fail(`${p}.phases`, 'non-empty');
  phases.forEach((ph, i) => {
    const prev = phases[i - 1];
    if (prev && ph.since <= prev.since) fail(`${p}.phases[${i}].since`, 'later than the previous phase');
  });
  const until = o['until'] === null ? null : num(o['until'], `${p}.until`);
  const last = phases[phases.length - 1];
  if (until !== null && last && until <= last.since) fail(`${p}.until`, 'later than the last phase');
  const shapes = arr(o['shapes'], `${p}.shapes`).map((x, i) =>
    path(x, `${p}.shapes[${i}]`, kind === 'building' ? 3 : 2),
  );
  const units = optional(o['units'], `${p}.units`, num);
  const tama38 = optional(o['tama38'], `${p}.tama38`, bool);
  const nightWorks = optional(o['nightWorks'], `${p}.nightWorks`, bool);
  const untilEstimated = optional(o['untilEstimated'], `${p}.untilEstimated`, bool);
  const stage = optional(o['stage'], `${p}.stage`, str);
  const traffic = optional(o['traffic'], `${p}.traffic`, str);
  const link = optional(o['link'], `${p}.link`, httpsLink);
  return {
    id: str(o['id'], `${p}.id`),
    city: str(o['city'], `${p}.city`),
    kind,
    title: str(o['title'], `${p}.title`),
    address: str(o['address'], `${p}.address`),
    position: latLng(o['position'], `${p}.position`),
    shapes,
    phases,
    until,
    ...(untilEstimated === undefined ? {} : { untilEstimated }),
    ...(stage === undefined ? {} : { stage }),
    ...(units === undefined ? {} : { units }),
    ...(tama38 === undefined ? {} : { tama38 }),
    ...(nightWorks === undefined ? {} : { nightWorks }),
    ...(traffic === undefined ? {} : { traffic }),
    ...(link === undefined ? {} : { link }),
  };
}

/** Validates raw JSON and returns it typed. Throws a `SchemaError` naming the first offending path. */
export function parseConstruction(raw: unknown): ConstructionData {
  const o = obj(raw, '$');
  const fetchedAt = str(o['fetchedAt'], 'fetchedAt');
  if (Number.isNaN(Date.parse(fetchedAt))) fail('fetchedAt', 'an ISO date');
  const data: ConstructionData = {
    fetchedAt,
    snapshot: num(o['snapshot'], 'snapshot'),
    sources: arr(o['sources'], 'sources').map((x, i) => {
      const s = obj(x, `sources[${i}]`);
      return {
        city: str(s['city'], `sources[${i}].city`),
        name: str(s['name'], `sources[${i}].name`),
        url: httpsLink(s['url'], `sources[${i}].url`),
        count: num(s['count'], `sources[${i}].count`),
      };
    }),
    projects: arr(o['projects'], 'projects').map((x, i) => project(x, `projects[${i}]`)),
  };
  unique(data.projects.map((p) => p.id));
  return data;
}
