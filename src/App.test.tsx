import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, PLAY_INTERVAL_MS } from './App.tsx';
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

  it('plays through the events', () => {
    vi.useFakeTimers();
    try {
      render(<App network={NETWORK} />);
      act(() => {
        screen.getByRole('button', { name: 'הפעלה' }).click();
      });
      act(() => {
        vi.advanceTimersByTime(PLAY_INTERVAL_MS);
      });
      expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
      act(() => {
        screen.getByRole('button', { name: 'עצירה' }).click();
      });
      act(() => {
        vi.advanceTimersByTime(PLAY_INTERVAL_MS * 3);
      });
      expect(screen.getByTestId('map')).toHaveAttribute('data-time', '2028.25');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides a line from the legend', async () => {
    render(<App network={NETWORK} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /הקו הסגול/ }));
    expect(screen.getByTestId('map')).toHaveAttribute('data-hidden', 'purple');
  });

  it('shows the version', () => {
    render(<App network={NETWORK} />);
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });
});
