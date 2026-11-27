/** Small validators shared by the JSON schemas (network.json, construction.json). */

/** [latitude, longitude] */
export type LatLng = readonly [number, number];

export class SchemaError extends Error {
  constructor(file: string, path: string, expected: string) {
    super(`${file}: ${path} must be ${expected}`);
    this.name = 'SchemaError';
  }
}

export type Obj = Record<string, unknown>;

/** Validators bound to one file name, so errors read `network.json: sections[3].id must be …`. */
export function validators(file: string) {
  const fail = (path: string, expected: string): never => {
    throw new SchemaError(file, path, expected);
  };
  function obj(v: unknown, path: string): Obj {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'an object');
    return v as Obj;
  }
  function arr(v: unknown, path: string): readonly unknown[] {
    if (!Array.isArray(v)) fail(path, 'an array');
    return v as readonly unknown[];
  }
  function str(v: unknown, path: string): string {
    if (typeof v !== 'string' || v.length === 0) fail(path, 'a non-empty string');
    return v as string;
  }
  function num(v: unknown, path: string): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'a finite number');
    return v as number;
  }
  function bool(v: unknown, path: string): boolean {
    if (typeof v !== 'boolean') fail(path, 'a boolean');
    return v as boolean;
  }
  function latLng(v: unknown, path: string): LatLng {
    const a = arr(v, path);
    const lat = num(a[0], `${path}[0]`);
    const lng = num(a[1], `${path}[1]`);
    // Gush Dan and its surroundings.
    if (a.length !== 2 || lat < 31.5 || lat > 32.5 || lng < 34.5 || lng > 35.2) {
      fail(path, '[lat, lng] inside central Israel');
    }
    return [lat, lng];
  }
  function path(v: unknown, p: string, min = 2): readonly LatLng[] {
    const pts = arr(v, p).map((x, i) => latLng(x, `${p}[${i}]`));
    if (pts.length < min) fail(p, `a path of at least ${String(min)} points`);
    return pts;
  }
  /** `undefined` when absent; otherwise validated by `check`. */
  function optional<T>(v: unknown, p: string, check: (v: unknown, p: string) => T): T | undefined {
    return v === undefined ? undefined : check(v, p);
  }
  function unique(ids: readonly string[]): void {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) fail(`id "${id}"`, 'unique');
      seen.add(id);
    }
  }
  return { fail, obj, arr, str, num, bool, latLng, path, optional, unique };
}
