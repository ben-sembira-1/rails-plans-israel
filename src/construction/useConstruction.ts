import { useEffect, useState } from 'react';
import { parseConstruction, type ConstructionData } from '../data/construction.ts';

export type ConstructionState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: ConstructionData }
  | { readonly status: 'missing'; readonly reason: string };

/** The daily snapshot, deployed next to the site by .github/workflows/construction-data.yml. */
export function constructionUrl(base: string = import.meta.env.BASE_URL): string {
  return `${base}data/construction.json`;
}

/**
 * Development uses a fixed sample (real projects around Allenby and Dizengoff), so screenshots don't change from
 * day to day; `?construction=live` reads public/data/construction.json from `npm run construction:fetch` instead.
 */
async function load(signal: AbortSignal): Promise<ConstructionData> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('construction') !== 'live') {
    const sample = await import('./sample.json');
    return parseConstruction(sample.default);
  }
  const res = await fetch(constructionUrl(), { signal });
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  return parseConstruction(await res.json());
}

/** Loads the snapshot once (when `enabled`). */
export function useConstruction(enabled = true): ConstructionState {
  const [state, setState] = useState<ConstructionState>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return undefined;
    const ac = new AbortController();
    load(ac.signal)
      .then((data) => {
        setState({ status: 'ready', data });
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted)
          setState({ status: 'missing', reason: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      ac.abort();
    };
  }, [enabled]);
  return state;
}
