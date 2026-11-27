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

  /** Searches a fixed place and saves it, leaving its card open. */
  async addSamplePlace(): Promise<void> {
    const search = this.page.locator('gmp-place-autocomplete');
    if ((await search.count()) === 0) throw new NotApplicable('this version has no place search');
    await search.click();
    await this.page.keyboard.type('דיזנגוף סנטר', { delay: 40 });
    await this.page.waitForTimeout(2000);
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    const save = this.page.getByRole('button', { name: 'שמירה כמקום מעניין' });
    await save.waitFor({ timeout: 15000 });
    await save.click();
    await this.page.getByRole('textbox', { name: 'הערה חדשה' }).waitFor({ timeout: 10000 });
  }

  /** Opens Google's details panel from the open place card. */
  async openDetails(): Promise<void> {
    const details = this.page.getByRole('button', { name: 'פרטים מגוגל' });
    if ((await details.count()) === 0) throw new NotApplicable('this version has no Google details panel');
    await details.first().click();
    await this.page.waitForTimeout(4000);
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
