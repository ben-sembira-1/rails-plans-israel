import { isLineId, type LineId } from '../domain/lines.ts';
import { validators, type LatLng } from './validate.ts';

export type { LatLng } from './validate.ts';

/** Works status of a section at a point in time. */
export type WorksStatus = 'none' | 'minor' | 'major' | 'open';
export const WORKS_STATUSES: readonly WorksStatus[] = ['none', 'minor', 'major', 'open'];

export interface Phase {
  /** Decimal year the phase starts (2026.75 = 2026Q4); `null` = already in this phase when the timeline starts. */
  readonly since: number | null;
  readonly status: WorksStatus;
  readonly note: string;
}

export interface Section {
  readonly id: string;
  readonly name: string;
  readonly line: LineId;
  readonly paths: readonly (readonly LatLng[])[];
  /** Ordered by `since`; only the first phase may have `since: null`. */
  readonly phases: readonly Phase[];
}

/** A point work site (metro preparatory works before the line-wide heavy works start). */
export interface Site {
  readonly id: string;
  readonly name: string;
  readonly line: LineId;
  readonly position: LatLng;
  readonly approximate: boolean;
  readonly since: number;
  readonly note: string;
}

export interface Station {
  readonly name: string;
  readonly line: LineId;
  readonly position: LatLng;
  /** Decimal year the station opens. */
  readonly opens: number;
  readonly approximate: boolean;
}

export interface RailStation {
  readonly name: string;
  readonly position: LatLng;
}

export interface Network {
  /** The day the network data (lines, phases, dates) was last checked against the sources, `YYYY-MM-DD`. */
  readonly updated: string;
  readonly sections: readonly Section[];
  readonly sites: readonly Site[];
  readonly stations: readonly Station[];
  readonly railStations: readonly RailStation[];
  /** Israel Railways geometry used until (or instead of) the live OpenStreetMap layer. */
  readonly railFallback: readonly (readonly LatLng[])[];
}

const { fail, obj, arr, str, num, bool, latLng, path, unique } = validators('network.json');

function line(v: unknown, p: string): LineId {
  if (!isLineId(v)) fail(p, 'a line id');
  return v as LineId;
}
function status(v: unknown, p: string): WorksStatus {
  const s = WORKS_STATUSES.find((x) => x === v);
  if (s === undefined) return fail(p, `one of ${WORKS_STATUSES.join(', ')}`);
  return s;
}

function phase(v: unknown, p: string): Phase {
  const o = obj(v, p);
  return {
    since: o['since'] === null ? null : num(o['since'], `${p}.since`),
    status: status(o['status'], `${p}.status`),
    note: str(o['note'], `${p}.note`),
  };
}

function section(v: unknown, p: string): Section {
  const o = obj(v, p);
  const phases = arr(o['phases'], `${p}.phases`).map((x, i) => phase(x, `${p}.phases[${i}]`));
  if (phases.length === 0) fail(`${p}.phases`, 'non-empty');
  phases.forEach((ph, i) => {
    if (i === 0) return;
    const prevSince = phases[i - 1]?.since ?? null;
    if (ph.since === null || (prevSince !== null && ph.since <= prevSince)) {
      fail(`${p}.phases[${i}].since`, 'set and later than the previous phase');
    }
  });
  return {
    id: str(o['id'], `${p}.id`),
    name: str(o['name'], `${p}.name`),
    line: line(o['line'], `${p}.line`),
    paths: arr(o['paths'], `${p}.paths`).map((x, i) => path(x, `${p}.paths[${i}]`)),
    phases,
  };
}

function site(v: unknown, p: string): Site {
  const o = obj(v, p);
  return {
    id: str(o['id'], `${p}.id`),
    name: str(o['name'], `${p}.name`),
    line: line(o['line'], `${p}.line`),
    position: latLng(o['position'], `${p}.position`),
    approximate: bool(o['approximate'], `${p}.approximate`),
    since: num(o['since'], `${p}.since`),
    note: str(o['note'], `${p}.note`),
  };
}

function station(v: unknown, p: string): Station {
  const o = obj(v, p);
  return {
    name: str(o['name'], `${p}.name`),
    line: line(o['line'], `${p}.line`),
    position: latLng(o['position'], `${p}.position`),
    opens: num(o['opens'], `${p}.opens`),
    approximate: bool(o['approximate'], `${p}.approximate`),
  };
}

function railStation(v: unknown, p: string): RailStation {
  const o = obj(v, p);
  return { name: str(o['name'], `${p}.name`), position: latLng(o['position'], `${p}.position`) };
}

/** Validates raw JSON and returns it typed. Throws a `SchemaError` naming the first offending path. */
export function parseNetwork(raw: unknown): Network {
  const o = obj(raw, '$');
  const updated = str(o['updated'], 'updated');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated) || Number.isNaN(Date.parse(updated)))
    fail('updated', 'a YYYY-MM-DD date');
  const network: Network = {
    updated,
    sections: arr(o['sections'], 'sections').map((x, i) => section(x, `sections[${i}]`)),
    sites: arr(o['sites'], 'sites').map((x, i) => site(x, `sites[${i}]`)),
    stations: arr(o['stations'], 'stations').map((x, i) => station(x, `stations[${i}]`)),
    railStations: arr(o['railStations'], 'railStations').map((x, i) => railStation(x, `railStations[${i}]`)),
    railFallback: arr(o['railFallback'], 'railFallback').map((x, i) => path(x, `railFallback[${i}]`)),
  };
  unique([...network.sections.map((s) => s.id), ...network.sites.map((s) => s.id)]);
  return network;
}
