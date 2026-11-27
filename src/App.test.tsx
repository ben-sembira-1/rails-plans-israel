import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.tsx';
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
  return screen.getByRole('group', { name: 'שינויי מצב עבודות' });
}
function milestonesGroup() {
  return screen.getByRole('group', { name: 'אבני דרך' });
}

describe('App', () => {
  it('starts at today and highlights the "today" event', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2026.75');
    const today = within(eventsGroup()).getByRole('button', { pressed: true });
    expect(today).toHaveTextContent('2026Q4');
    expect(within(milestonesGroup()).queryByRole('button', { pressed: true })).toBeNull();
  });

  it('starts at the saved position when one is given', () => {
    render(<App network={NETWORK} maps={MAPS} initialTime={2030} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2030');
  });

  it('jumps to a milestone and highlights it in both rows', async () => {
    const onTimeChange = vi.fn();
    render(<App network={NETWORK} maps={MAPS} onTimeChange={onTimeChange} />);
    await userEvent.click(within(milestonesGroup()).getByRole('button', { name: 'אמצע 2028' }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
    expect(within(milestonesGroup()).getByRole('button', { pressed: true })).toHaveTextContent('אמצע 2028');
    expect(within(eventsGroup()).getByRole('button', { pressed: true })).toHaveTextContent('2028Q2');
    expect(onTimeChange).toHaveBeenLastCalledWith(2028.25);
    expect(screen.getByText('יוני–יולי 2028 · הקו הסגול')).toBeInTheDocument();
  });

  it('lists the sections under heavy works', async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    await userEvent.click(within(eventsGroup()).getByRole('button', { name: /2029Q1/ }));
    expect(screen.getByText(/M1 – שלב א׳/)).toBeInTheDocument();
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
    await userEvent.click(within(milestonesGroup()).getByRole('button', { name: 'ללא מועד' }));
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

  it('starts closed on a phone and opens from the toggle', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('800px') }));
    try {
      render(<App network={NETWORK} maps={MAPS} />);
      const toggle = screen.getByRole('button', { name: /מקרא ואירועים/ });
      const panel = screen.getByRole('complementary', { name: 'לוח בקרה' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-controls', panel.id);
      expect(panel).not.toHaveClass('open');
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(panel).toHaveClass('open');
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
    expect(screen.getByRole('group', { name: 'אבני דרך' })).toBeInTheDocument();

    await userEvent.click(trains);
    expect(panel).not.toHaveClass('open');
    expect(container.querySelector('.workspace')).toHaveClass('panel-closed');
    expect(screen.queryByRole('group', { name: 'אבני דרך' })).toBeNull();
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-selected') === 'false')).toBe(true);

    await userEvent.click(screen.getByRole('tab', { name: 'מקומות מעניינים (0)' }));
    expect(panel).toHaveClass('open');
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

  it('documents how to read the map in the side panel', () => {
    render(<App network={NETWORK} maps={MAPS} />);
    const docs = screen.getByRole('region', { name: 'איך לקרוא את המפה' });
    expect(within(docs).getByText(/קו מלא – פועל/)).toBeInTheDocument();
    expect(within(docs).getByText(/מקורות:/)).toBeInTheDocument();
  });

  it('hides a line from the legend', async () => {
    render(<App network={NETWORK} maps={MAPS} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /הקו הסגול/ }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-hidden', 'purple');
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
