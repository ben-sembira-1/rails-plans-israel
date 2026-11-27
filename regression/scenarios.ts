import type { Page } from '@playwright/test';

/**
 * The regression list: every PR is screenshotted in each scenario, in each layout, and compared with earlier
 * releases before it is marked ready for review (see docs/REGRESSION.md). Keep this list up to date when UI states
 * are added or change.
 */

export interface Layout {
  readonly id: 'desktop' | 'phone';
  readonly title: string;
  readonly width: number;
  readonly height: number;
}

export const LAYOUTS: readonly Layout[] = [
  { id: 'desktop', title: 'Desktop', width: 1440, height: 900 },
  { id: 'phone', title: 'Phone', width: 390, height: 844 },
];

interface SeedPlace {
  readonly googlePlaceId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
}

let sample: Promise<SeedPlace> | null = null;

/** Dizengoff Center from one Google text search, shared by every scenario of the run. */
function samplePlace(page: Page): Promise<SeedPlace> {
  sample ??= page.evaluate(async () => {
    interface GooglePlace {
      id: string;
      displayName?: string | null;
      formattedAddress?: string | null;
      location?: { lat: () => number; lng: () => number } | null;
    }
    interface PlacesLib {
      Place: { searchByText: (r: object) => Promise<{ places: GooglePlace[] }> };
    }
    const g = (window as unknown as { google: { maps: { importLibrary: (n: string) => Promise<unknown> } } })
      .google;
    const { Place } = (await g.maps.importLibrary('places')) as PlacesLib;
    const { places } = await Place.searchByText({
      textQuery: 'דיזנגוף סנטר, תל אביב',
      fields: ['id', 'displayName', 'formattedAddress', 'location'],
      language: 'he',
      maxResultCount: 1,
    });
    const p = places[0];
    if (!p?.location) throw new Error('Dizengoff Center not found');
    return {
      googlePlaceId: p.id,
      name: p.displayName ?? 'דיזנגוף סנטר',
      address: p.formattedAddress ?? '',
      lat: p.location.lat(),
      lng: p.location.lng(),
    };
  });
  return sample;
}

/** A step that the version under test doesn't support (e.g. a feature added later). */
export class NotApplicable extends Error {}

/** Version-tolerant UI actions used by the scenarios. */
export class Ui {
  readonly page: Page;
  readonly layout: Layout;

  constructor(page: Page, layout: Layout) {
    this.page = page;
    this.layout = layout;
  }

  private tab(name: 'trains' | 'places') {
    return this.page.getByRole('tab', { name: name === 'trains' ? 'מידע על הרכבות' : /מקומות מעניינים/ });
  }

  private toggle() {
    return this.page.locator('.panel-toggle, .dock-toggle').first();
  }

  private async visible(locator: ReturnType<Page['locator']>): Promise<boolean> {
    return (await locator.count()) > 0 && (await locator.first().isVisible());
  }

  /** Opens the side panel's toggle on a phone, if it is closed. */
  private async openPhonePanel(): Promise<void> {
    const toggle = this.toggle();
    if (this.layout.id === 'phone' && (await this.visible(toggle))) {
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    }
  }

  /** Closes the side panel: the open tab's header (desktop) or the toggle (phone). */
  async closePanel(): Promise<void> {
    const toggle = this.toggle();
    if (this.layout.id === 'phone' && (await this.visible(toggle))) {
      if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
      return;
    }
    const open = this.page.locator('[role="tab"][aria-selected="true"]');
    if ((await open.count()) === 0) {
      if ((await this.page.locator('[role="tab"]').count()) === 0) {
        throw new NotApplicable('this version has no closable side panel');
      }
      return;
    }
    await open.first().click();
  }

  /** Opens a side-panel tab. Versions without tabs show the trains information as the whole panel. */
  async openTab(name: 'trains' | 'places'): Promise<void> {
    await this.openPhonePanel();
    const tab = this.tab(name);
    if ((await tab.count()) === 0) {
      if (name === 'places') throw new NotApplicable('this version has no places tab');
      return;
    }
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  }

  /**
   * Starts the app with one saved place (Dizengoff Center) and opens its card from the places list.
   *
   * Google's search box sends an Autocomplete request on every keystroke, which spent the key's daily quota, so the
   * place comes from one text search per run and is seeded through the dev-only `?seed-place=` parameter.
   */
  async addSamplePlace(): Promise<void> {
    if ((await this.page.locator('gmp-place-autocomplete').count()) === 0) {
      throw new NotApplicable('this version has no places');
    }
    const seed = await samplePlace(this.page);
    const url = new URL(this.page.url());
    url.search = `?seed-place=${encodeURIComponent(JSON.stringify(seed))}`;
    await this.page.goto(url.toString(), { waitUntil: 'load' });
    await this.page.waitForSelector('#root > *', { timeout: 30000 });
    await this.openTab('places');
    await this.page
      .getByRole('region', { name: 'מקומות מעניינים' })
      .getByRole('button', { name: new RegExp(seed.name) })
      .click();
    await this.page.getByRole('textbox', { name: 'הערה חדשה' }).waitFor({ timeout: 15000 });
  }

  /**
   * Centers the map on a point at a zoom level, in any version: it finds the map object (Leaflet or Google) in the
   * running React tree, so old releases need no test hooks.
   */
  async focusMap(lat: number, lng: number, zoom: number): Promise<void> {
    const found = await this.page.evaluate(
      ([la, ln, z]) => {
        interface Fiber {
          child: Fiber | null;
          sibling: Fiber | null;
          memoizedProps?: { value?: { map?: unknown } } | null;
        }
        interface AnyMap {
          setView?: (c: [number, number], z: number, o: object) => void;
          setCenter?: (c: object) => void;
          setZoom?: (z: number) => void;
        }
        const root = document.getElementById('root');
        if (!root) return false;
        const key = Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
        if (!key) return false;
        const start = (root as unknown as Record<string, Fiber | undefined>)[key];
        if (!start) return false;
        const stack: Fiber[] = [start];
        while (stack.length > 0) {
          const f = stack.pop();
          if (!f) continue;
          const map = f.memoizedProps?.value?.map as AnyMap | undefined;
          if (map?.setView) {
            map.setView([la, ln], z, { animate: false });
            return true;
          }
          if (map?.setCenter && map.setZoom) {
            map.setCenter({ lat: la, lng: ln });
            map.setZoom(z);
            return true;
          }
          if (f.sibling) stack.push(f.sibling);
          if (f.child) stack.push(f.child);
        }
        return false;
      },
      [lat, lng, zoom] as const,
    );
    if (!found) throw new NotApplicable('could not find the map in this version');
  }

  /** Fails as n/a in versions without the city construction layers. */
  async requireConstruction(): Promise<void> {
    await this.openTab('trains');
    const group = this.page.getByRole('group', { name: 'שכבות בנייה' });
    if ((await group.count()) === 0) throw new NotApplicable('this version has no construction layers');
  }

  /** Jumps the timeline to a milestone from the side panel (e.g. "ללא מועד"). */
  async goToMilestone(label: string): Promise<void> {
    await this.openTab('trains');
    await this.page.getByRole('group', { name: 'אבני דרך' }).getByRole('button', { name: label }).click();
  }

  /** Clicks the middle of the map (after `focusMap` on a feature) and waits for its popup. */
  async clickMapCenter(popup: string): Promise<void> {
    const box = await this.page.locator('.map').boundingBox();
    if (!box) throw new Error('no map');
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.locator(popup).waitFor({ timeout: 10000 });
  }

  /** Opens Google's details panel from the open place card. */
  async openDetails(): Promise<void> {
    const details = this.page.getByRole('button', { name: 'פרטים מגוגל' });
    if ((await details.count()) === 0) throw new NotApplicable('this version has no Google details panel');
    await details.first().click();
    await this.page.locator('gmp-place-details').waitFor({ timeout: 10000 });
  }
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly run: (ui: Ui) => Promise<void>;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'all-closed',
    title: 'Everything closed',
    run: (ui) => ui.closePanel(),
  },
  {
    // Zone widths at real scale: 20 m (dark, heavy) and 100 m (light) on each side of the line.
    id: 'works-closeup',
    title: 'Close-up: Purple Line heavy works on Allenby (zoom 16)',
    run: (ui) => ui.focusMap(32.0665, 34.7725, 16),
  },
  {
    // Real Tel Aviv projects from the development sample (src/construction/sample.json) at today's step.
    id: 'construction-layer',
    title: 'City construction: sites with 20 m / 50 m noise zones near Allenby (zoom 17)',
    run: async (ui) => {
      await ui.requireConstruction();
      await ui.closePanel();
      await ui.focusMap(32.0645, 34.7722, 17);
    },
  },
  {
    // Zoomed out, projects are counted per area: bubbles with a number and a ring of layer shares.
    id: 'construction-overview',
    title: 'City construction: projects counted per area (zoom 14)',
    run: async (ui) => {
      await ui.requireConstruction();
      await ui.closePanel();
      await ui.focusMap(32.068, 34.776, 14);
    },
  },
  {
    id: 'construction-popup',
    title: 'City construction: a site popup (Allenby 110)',
    run: async (ui) => {
      await ui.requireConstruction();
      await ui.closePanel();
      await ui.focusMap(32.06439, 34.77221, 18);
      await ui.clickMapCenter('.project-pop');
    },
  },
  {
    id: 'construction-upcoming',
    title: 'City construction: upcoming permits at the "no date" step (zoom 16)',
    run: async (ui) => {
      await ui.requireConstruction();
      await ui.goToMilestone('ללא מועד');
      await ui.closePanel();
      await ui.focusMap(32.0665, 34.7725, 16);
    },
  },
  {
    id: 'trains-tab',
    title: 'Side panel: trains information',
    run: (ui) => ui.openTab('trains'),
  },
  {
    id: 'places-tab',
    title: 'Side panel: places of interest (one saved place)',
    run: async (ui) => {
      await ui.addSamplePlace();
      await ui.openTab('places');
    },
  },
  {
    id: 'details-panel',
    title: 'Google details panel (side panel closed)',
    run: async (ui) => {
      await ui.addSamplePlace();
      await ui.openDetails();
      await ui.closePanel();
    },
  },
  {
    id: 'places-and-details',
    title: 'Places tab and Google details panel together',
    run: async (ui) => {
      await ui.addSamplePlace();
      await ui.openDetails();
      await ui.openTab('places');
    },
  },
];
