/**
 * A small, polite ArcGIS REST client: one request at a time, a pause between requests, and retries (the Tel Aviv
 * server sometimes cuts long responses short, so every page is parsed fully before it is accepted).
 */

export type Position = readonly [number, number];

export type Geometry =
  | { readonly type: 'Polygon'; readonly coordinates: readonly (readonly Position[])[] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly (readonly (readonly Position[])[])[] }
  | { readonly type: 'LineString'; readonly coordinates: readonly Position[] }
  | { readonly type: 'MultiLineString'; readonly coordinates: readonly (readonly Position[])[] }
  | { readonly type: 'Point'; readonly coordinates: Position };

export interface Feature {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly geometry: Geometry | null;
}

export interface QueryOptions {
  readonly where?: string;
  readonly outFields: readonly string[];
  /** A field to page in a stable order (the layer's object id). */
  readonly orderBy: string;
  readonly pageSize?: number;
}

export interface ClientOptions {
  readonly fetch?: typeof fetch;
  readonly delayMs?: number;
  readonly retries?: number;
  readonly timeoutMs?: number;
  readonly log?: (line: string) => void;
}

/** Sent with every request: a generic client name, without personal or project details. */
export const USER_AGENT = 'construction-snapshot-bot/1.0 (once a day)';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function isFeatureCollection(v: unknown): v is { features: Feature[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { features?: unknown }).features);
}

export function queryUrl(layerUrl: string, q: QueryOptions, offset: number, pageSize: number): string {
  const params = new URLSearchParams({
    where: q.where ?? '1=1',
    outFields: q.outFields.join(','),
    orderByFields: q.orderBy,
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    outSR: '4326',
    geometryPrecision: '6',
    // Server-side simplification to about 1 m keeps the pages (and our file) small.
    maxAllowableOffset: '0.00001',
    f: 'geojson',
  });
  return `${layerUrl}/query?${params.toString()}`;
}

/** Every feature matching the query, page by page. */
export async function queryAll(
  layerUrl: string,
  q: QueryOptions,
  opts: ClientOptions = {},
): Promise<Feature[]> {
  const doFetch = opts.fetch ?? fetch;
  const pageSize = q.pageSize ?? 1000;
  const retries = opts.retries ?? 4;
  const delayMs = opts.delayMs ?? 1000;
  const log = opts.log ?? (() => undefined);
  const all: Feature[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = queryUrl(layerUrl, q, offset, pageSize);
    let page: Feature[] | null = null;
    let lastError = '';
    for (let attempt = 0; attempt <= retries && page === null; attempt++) {
      if (attempt > 0) await sleep(delayMs * 2 ** attempt);
      try {
        const res = await doFetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json, application/json' },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
        });
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
        const body: unknown = JSON.parse(await res.text());
        if (!isFeatureCollection(body))
          throw new Error(`not a feature collection: ${JSON.stringify(body).slice(0, 200)}`);
        page = body.features;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        log(`  retry ${String(attempt + 1)}/${String(retries)} after: ${lastError}`);
      }
    }
    if (page === null) throw new Error(`${layerUrl}: offset ${String(offset)} failed: ${lastError}`);
    all.push(...page);
    log(`  ${layerUrl.split('/').slice(-1).join('')}: ${String(all.length)} features`);
    if (page.length < pageSize) return all;
    await sleep(delayMs);
  }
}
