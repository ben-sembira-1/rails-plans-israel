import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.tsx';
import { PLAY_EVENT_MS, PLAY_STEP_MS } from './components/TimelineBar.tsx';
import { NETWORK } from './data/network.ts';
import { createMemoryStore } from './places/memoryStore.ts';

const MAPS = { apiKey: 'test-key', mapId: 'test-map' };

// Google Maps needs a browser with the Maps API; the map itself is covered by the domain tests.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => children,
  useMapsLibrary: () => null,
}));
vi.mock('./components/MapView.tsx', () => ({
  MapView: ({
    time,
    hidden,
    children,
  }: {
    time: number;
    hidden: ReadonlySet<string>;
    children?: React.ReactNode;
  }) => (
    <div data-testid="map" data-time={time} data-hidden={[...hidden].join(',')}>
      {children}
    </div>
  ),
}));
vi.mock('./places/PlaceSearch.tsx', () => ({
  PlaceSearch: ({ onPick }: { onPick: (p: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        onPick({ googlePlaceId: 'g-cafe', name: 'קפה ביאליק', address: 'ביאליק 2', lat: 32.07, lng: 34.77 });
      }}
    >
      search result
    </button>
  ),
}));
vi.mock('./places/PlacesLayer.tsx', () => ({
  PlacesLayer: ({ places, card }: { places: readonly { name: string }[]; card: React.ReactNode }) => (
    <div data-testid="pins" data-names={places.map((p) => p.name).join(',')}>
      {card}
    </div>
  ),
}));
vi.mock('./places/PlaceDetailsPanel.tsx', () => ({
  PlaceDetailsPanel: ({ googlePlaceId, onClose }: { googlePlaceId: string; onClose: () => void }) => (
    <aside aria-label="google details" data-place={googlePlaceId}>
      <button type="button" onClick={onClose}>
        close details
      </button>
    </aside>
  ),
}));

function eventsGroup() {
  return screen.getByRole('group', { name: 'ציר האירועים' });
}

beforeEach(() => {
  // The time is kept in the address (`?t=`); start every test from a clean one.
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('starts at today and highlights the "today" event', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2026.75');
    const today = within(eventsGroup()).getByRole('button', { pressed: true });
    expect(today).toHaveTextContent('2026Q4');
    expect(today).toHaveTextContent('היום');
  });

  it('starts at the saved position when one is given', () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2030} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2030');
  });

  it('jumps to a milestone from the event list and highlights it there and on the bar', async () => {
    const onTimeChange = vi.fn();
    render(<App network={NETWORK} maps={MAPS} onTimeChange={onTimeChange} />);
    await userEvent.click(within(eventsGroup()).getByRole('button', { name: /2028Q2/ }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
    expect(within(eventsGroup()).getByRole('button', { pressed: true })).toHaveTextContent('הסגול נפתח');
    expect(screen.getByRole('button', { name: '2028Q2 · אמצע 2028' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(onTimeChange).toHaveBeenLastCalledWith(2028.25);
    expect(screen.getByText('יוני–יולי 2028 · הקו הסגול')).toBeInTheDocument();
  });

  it("shows each line's state in a word, and where the works are", async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    await userEvent.click(within(eventsGroup()).getByRole('button', { name: /2029Q1/ }));
    const lines = screen.getByRole('list', { name: 'מצב הקווים' });
    const m1 = within(lines).getByText('מטרו M1').closest('li');
    expect(m1).not.toBeNull();
    if (m1) {
      expect(within(m1).getByText('עבודות כבדות')).toBeInTheDocument();
      expect(within(m1).getByText('שלב א׳: ראשונים–גלילות')).toBeInTheDocument();
    }
    const red = within(lines).getByText('הקו האדום').closest('li');
    if (red) expect(within(red).getByText('פועל')).toBeInTheDocument();
  });

  it('moves along the slider by quarter, then by year', () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2029.75} />);
    const slider = screen.getByRole('slider', { name: 'ציר זמן' });
    const index = Number((slider as HTMLInputElement).value);
    fireEvent.change(slider, { target: { value: String(index + 1) } });
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2030');
    fireEvent.change(slider, { target: { value: String(index + 2) } });
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2031');
  });

  it('steps back and forward by quarter, then by year, skipping no step', async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const map = screen.getByTestId('map');
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    expect(map).toHaveAttribute('data-time', '2027');
    await userEvent.click(screen.getByRole('button', { name: 'צעד אחורה' }));
    await userEvent.click(screen.getByRole('button', { name: 'צעד אחורה' }));
    expect(map).toHaveAttribute('data-time', '2026.5');
  });

  it('steps by full year from 2030', async () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2029.75} />);
    const map = screen.getByTestId('map');
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    expect(map).toHaveAttribute('data-time', '2030');
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    expect(map).toHaveAttribute('data-time', '2031');
  });

  it('disables "back" at the first step and "forward" at the last', async () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2023.5} />);
    expect(screen.getByRole('button', { name: 'צעד אחורה' })).toBeDisabled();
    await userEvent.click(within(eventsGroup()).getByRole('button', { name: /ללא מועד/ }));
    expect(screen.getByRole('button', { name: 'צעד קדימה' })).toBeDisabled();
  });

  it('puts every event on the bar, with the milestones as main markers', async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const markers = within(screen.getByRole('group', { name: 'סמנים על ציר הזמן' })).getAllByRole('button');
    const events = within(eventsGroup()).getAllByRole('button');
    expect(markers).toHaveLength(events.length);
    expect(markers.filter((m) => m.classList.contains('main'))).toHaveLength(6);
    const purple = markers.find((m) => m.getAttribute('aria-label') === '2028Q2 · אמצע 2028');
    expect(purple).toBeDefined();
    if (purple) await userEvent.click(purple);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
    expect(purple).toHaveAttribute('aria-pressed', 'true');
  });

  it('jumps back to today from the "today" marker', async () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2030} />);
    const today = screen.getByRole('button', { name: '2026Q4 · היום' });
    expect(today).toHaveClass('today');
    expect(today).toHaveAttribute('tabindex', '0');
    await userEvent.click(today);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2026.75');
    expect(today).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts as a peeking sheet on a phone and opens from its handle', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('800px') }));
    try {
      render(<App network={NETWORK} maps={MAPS} />);
      const handle = screen.getByRole('button', { name: 'פתיחת לוח המידע' });
      const panel = screen.getByRole('complementary', { name: 'לוח בקרה' });
      expect(handle).toHaveAttribute('aria-expanded', 'false');
      expect(handle).toHaveAttribute('aria-controls', panel.id);
      expect(panel).toHaveClass('sheet-peek');
      await userEvent.click(handle);
      expect(handle).toHaveAttribute('aria-expanded', 'true');
      expect(handle).toHaveAccessibleName('סגירת לוח המידע');
      expect(panel).toHaveClass('sheet-half');
      await userEvent.click(handle);
      expect(panel).toHaveClass('sheet-peek');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('closes the panel when the open tab is clicked, and reopens it', async () => {
    const store = createMemoryStore();
    const { container } = render(<App network={NETWORK} maps={MAPS} places={store} />);
    const panel = screen.getByRole('complementary', { name: 'לוח בקרה' });
    const trains = screen.getByRole('tab', { name: 'מידע על הרכבות' });
    expect(trains).toHaveAttribute('aria-selected', 'true');
    expect(eventsGroup()).toBeInTheDocument();

    await userEvent.click(trains);
    expect(panel).toHaveClass('sheet-peek');
    expect(container.querySelector('.workspace')).toHaveClass('panel-closed');
    expect(screen.queryByRole('group', { name: 'ציר האירועים' })).toBeNull();
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-selected') === 'false')).toBe(true);

    await userEvent.click(screen.getByRole('tab', { name: 'מקומות מעניינים (0)' }));
    expect(panel).not.toHaveClass('sheet-peek');
    expect(screen.getByRole('region', { name: 'מקומות מעניינים' })).toBeInTheDocument();
  });

  it('keeps previous and next together, before the bar', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const steps = screen.getByRole('group', { name: 'מעבר בציר הזמן' });
    expect(
      within(steps)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['צעד אחורה', 'צעד קדימה']);
    const timeline = screen.getByRole('region', { name: 'ציר זמן' });
    const panel = screen.getByRole('complementary', { name: 'לוח בקרה' });
    // The timeline comes before the side panel and the map.
    expect(timeline.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('documents how to read the map, the sources and how fresh the data is', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const docs = screen.getByRole('region', { name: 'איך לקרוא את המפה' });
    expect(within(docs).getByText(/קו מלא: פועל/)).toBeInTheDocument();
    expect(screen.getByText(/מקורות:/)).toBeInTheDocument();
    expect(screen.getByText(/נתוני הרכבות נכונים ל־27\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/האתר אינו אתר רשמי/)).toBeInTheDocument();
  });

  it('hides a line from the layers picker on the map', async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const layers = screen.getByRole('button', { name: 'שכבות' });
    expect(layers).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(layers);
    await userEvent.click(screen.getByRole('checkbox', { name: /הקו הסגול/ }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-hidden', 'purple');
    expect(within(layers).getByLabelText('חלק מהשכבות מוסתרות')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(layers).toHaveAttribute('aria-expanded', 'false');
  });

  it('plays the timeline step by step, and stops when the user moves it', () => {
    vi.useFakeTimers();
    try {
      render(<App network={NETWORK} maps={MAPS} initialTime={2027} />);
      const map = screen.getByTestId('map');
      fireEvent.click(screen.getByRole('button', { name: 'ניגון ציר הזמן' }));
      expect(screen.getByRole('button', { name: 'עצירת הניגון' })).toHaveAttribute('aria-pressed', 'true');
      act(() => {
        vi.advanceTimersByTime(PLAY_STEP_MS);
      });
      expect(map).toHaveAttribute('data-time', '2027.25');
      act(() => {
        vi.advanceTimersByTime(PLAY_STEP_MS);
      });
      expect(map).toHaveAttribute('data-time', '2027.5');
      fireEvent.click(screen.getByRole('button', { name: 'צעד אחורה' }));
      expect(screen.getByRole('button', { name: 'ניגון ציר הזמן' })).toHaveAttribute('aria-pressed', 'false');
      act(() => {
        vi.advanceTimersByTime(PLAY_EVENT_MS);
      });
      expect(map).toHaveAttribute('data-time', '2027.25');
    } finally {
      vi.useRealTimers();
    }
  });

  it('jumps to the next and previous event with PageUp and PageDown on the bar', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const slider = screen.getByRole('slider', { name: 'ציר זמן' });
    fireEvent.keyDown(slider, { key: 'PageUp' });
    const next = Number(screen.getByTestId('map').getAttribute('data-time'));
    expect(next).toBeGreaterThan(2026.75);
    expect(within(eventsGroup()).getByRole('button', { pressed: true })).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2026.75');
  });

  it('opens at the time in a shared link and keeps the address up to date', async () => {
    window.history.replaceState(null, '', '/?t=2030');
    render(<App network={NETWORK} maps={MAPS} initialTime={2027} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2030');
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    expect(window.location.search).toBe('?t=2031');
  });

  it('says what changed after a move, and closes the note', async () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2028} />);
    expect(screen.queryByRole('status', { name: 'מה השתנה' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    const note = screen.getByRole('status', { name: 'מה השתנה' });
    expect(within(note).getByText(/הקו הסגול:/)).toBeInTheDocument();
    await userEvent.click(within(note).getByRole('button', { name: 'סגירת ההודעה' }));
    expect(screen.queryByRole('status', { name: 'מה השתנה' })).toBeNull();
  });

  it('opens the about dialog from the top strip and closes it with Escape', async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    await userEvent.click(screen.getByRole('button', { name: 'אודות המפה' }));
    const dialog = screen.getByRole('dialog', { name: 'אודות המפה' });
    expect(within(dialog).getByText(/נתוני הרכבות נכונים ל־27\/11\/2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'דווחו עליה ב־GitHub' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('copies a link to the time shown', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App network={NETWORK} maps={MAPS} initialTime={2030} />);
    await userEvent.click(screen.getByRole('button', { name: 'העתקת קישור לזמן המוצג' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?t=2030'));
    expect(await screen.findByText('הקישור הועתק')).toBeInTheDocument();
  });

  it('shows the logo strip with the version and the current time', async () => {
    render(<App network={NETWORK} maps={MAPS} headerActions={<button type="button">admin</button>} />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
    expect(within(banner).getByLabelText('הזמן המוצג')).toHaveTextContent('2026Q4');
    expect(within(banner).getByRole('button', { name: 'admin' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    expect(within(banner).getByLabelText('הזמן המוצג')).toHaveTextContent('2027Q1');
  });

  it('shows a page instead of the map and keeps the timeline position', async () => {
    const { rerender } = render(<App network={NETWORK} maps={MAPS} />);
    await userEvent.click(screen.getByRole('button', { name: 'צעד קדימה' }));
    rerender(<App network={NETWORK} maps={MAPS} page={<main>admin page</main>} />);
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.getByText('admin page')).toBeInTheDocument();
    rerender(<App network={NETWORK} maps={MAPS} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2027');
  });

  it('explains a missing Google Maps key instead of the map', () => {
    render(<App network={NETWORK} maps={null} />);
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('VITE_GOOGLE_MAPS_API_KEY');
  });

  it('saves a searched place, lists it and opens Google details', async () => {
    const store = createMemoryStore();
    render(<App network={NETWORK} maps={MAPS} places={store} />);
    expect(screen.getByRole('tab', { name: 'מקומות מעניינים (0)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'search result' }));
    await userEvent.click(screen.getByRole('button', { name: 'שמירה כמקום מעניין' }));
    expect(screen.getByTestId('pins')).toHaveAttribute('data-names', 'קפה ביאליק');

    await userEvent.click(screen.getByRole('tab', { name: 'מקומות מעניינים (1)' }));
    expect(screen.getByRole('button', { name: /קפה ביאליק/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'פרטים מגוגל' }));
    expect(screen.getByRole('complementary', { name: 'google details' })).toHaveAttribute(
      'data-place',
      'g-cafe',
    );
    await userEvent.click(screen.getByRole('button', { name: 'close details' }));
    expect(screen.queryByRole('complementary', { name: 'google details' })).toBeNull();
  });

  it('hides the places features without a store', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['מידע על הרכבות']);
    expect(screen.queryByRole('button', { name: 'search result' })).toBeNull();
  });
});
