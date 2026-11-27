import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.tsx';
import { NETWORK } from './data/network.ts';

// Leaflet needs a real layout engine; the map itself is covered by the domain tests.
vi.mock('./components/MapView.tsx', () => ({
  MapView: ({ time, hidden }: { time: number; hidden: ReadonlySet<string> }) => (
    <div data-testid="map" data-time={time} data-hidden={[...hidden].join(',')} />
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
    render(<App network={NETWORK} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2026.75');
    const today = within(eventsGroup()).getByRole('button', { pressed: true });
    expect(today).toHaveTextContent('2026Q4');
    expect(within(milestonesGroup()).queryByRole('button', { pressed: true })).toBeNull();
  });

  it('starts at the saved position when one is given', () => {
    render(<App network={NETWORK} initialTime={2030} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2030');
  });

  it('jumps to a milestone and highlights it in both rows', async () => {
    const onTimeChange = vi.fn();
    render(<App network={NETWORK} onTimeChange={onTimeChange} />);
    await userEvent.click(within(milestonesGroup()).getByRole('button', { name: 'אמצע 2028' }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
    expect(within(milestonesGroup()).getByRole('button', { pressed: true })).toHaveTextContent('אמצע 2028');
    expect(within(eventsGroup()).getByRole('button', { pressed: true })).toHaveTextContent('2028Q2');
    expect(onTimeChange).toHaveBeenLastCalledWith(2028.25);
    expect(screen.getByText('יוני–יולי 2028 · הקו הסגול')).toBeInTheDocument();
  });

  it('lists the sections under heavy works', async () => {
    render(<App network={NETWORK} />);
    await userEvent.click(within(eventsGroup()).getByRole('button', { name: /2029Q1/ }));
    expect(screen.getByText(/M1 – שלב א׳/)).toBeInTheDocument();
  });

  it('moves along the slider by quarter, then by year', () => {
    render(<App network={NETWORK} initialTime={2029.75} />);
    const slider = screen.getByRole('slider', { name: 'ציר זמן' });
    const index = Number((slider as HTMLInputElement).value);
    fireEvent.change(slider, { target: { value: String(index + 1) } });
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2030');
    fireEvent.change(slider, { target: { value: String(index + 2) } });
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2031');
  });

  it('steps to the previous and next event', async () => {
    render(<App network={NETWORK} />);
    const map = screen.getByTestId('map');
    await userEvent.click(screen.getByRole('button', { name: 'האירוע הבא' }));
    expect(map).toHaveAttribute('data-time', '2028.25');
    await userEvent.click(screen.getByRole('button', { name: 'האירוע הקודם' }));
    await userEvent.click(screen.getByRole('button', { name: 'האירוע הקודם' }));
    expect(map).toHaveAttribute('data-time', '2026.5');
  });

  it('disables "previous" at the first event and "next" at the last', async () => {
    render(<App network={NETWORK} initialTime={2023.5} />);
    expect(screen.getByRole('button', { name: 'האירוע הקודם' })).toBeDisabled();
    await userEvent.click(within(milestonesGroup()).getByRole('button', { name: 'ללא מועד' }));
    expect(screen.getByRole('button', { name: 'האירוע הבא' })).toBeDisabled();
  });

  it('puts every event on the bar, with the milestones as main markers', async () => {
    render(<App network={NETWORK} />);
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

  it('opens and closes the events panel (phone layout)', async () => {
    render(<App network={NETWORK} />);
    const toggle = screen.getByRole('button', { name: /אירועים ופרטים/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'ציר זמן' })).toHaveClass('expanded');
  });

  it('hides a line from the legend', async () => {
    render(<App network={NETWORK} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /הקו הסגול/ }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-hidden', 'purple');
  });

  it('shows the logo strip with the version and the current time', async () => {
    render(<App network={NETWORK} headerActions={<button type="button">admin</button>} />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
    expect(within(banner).getByLabelText('הזמן המוצג')).toHaveTextContent('2026Q4');
    expect(within(banner).getByRole('button', { name: 'admin' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'האירוע הבא' }));
    expect(within(banner).getByLabelText('הזמן המוצג')).toHaveTextContent('2028Q2');
  });

  it('shows a page instead of the map and keeps the timeline position', async () => {
    const { rerender } = render(<App network={NETWORK} />);
    await userEvent.click(screen.getByRole('button', { name: 'האירוע הבא' }));
    rerender(<App network={NETWORK} page={<main>admin page</main>} />);
    expect(screen.queryByTestId('map')).toBeNull();
    expect(screen.getByText('admin page')).toBeInTheDocument();
    rerender(<App network={NETWORK} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
  });
});
