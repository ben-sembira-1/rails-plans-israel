import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryStore } from './memoryStore.ts';
import { CandidateCard, SavedPlaceCard } from './PlaceCards.tsx';
import type { SavedPlace } from './types.ts';

const cafe = { googlePlaceId: 'g1', name: 'Café', address: 'Dizengoff 1', lat: 32.08, lng: 34.77 };

async function saved(): Promise<{ store: ReturnType<typeof createMemoryStore>; place: SavedPlace }> {
  const store = createMemoryStore();
  const id = await store.addPlace(cafe);
  return { store, place: { ...cafe, id, createdAt: null } };
}

describe('SavedPlaceCard', () => {
  it('adds and deletes comments', async () => {
    const { store, place } = await saved();
    render(<SavedPlaceCard store={store} place={place} onShowDetails={vi.fn()} />);
    expect(screen.getByText('אין הערות עדיין.')).toBeInTheDocument();

    const add = screen.getByRole('button', { name: 'הוספה' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'הערה חדשה' }), 'Good coffee, quiet');
    await userEvent.click(add);
    const list = screen.getByRole('list', { name: 'הערות' });
    expect(within(list).getByText('Good coffee, quiet')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'הערה חדשה' })).toHaveValue('');

    await userEvent.click(screen.getByRole('button', { name: 'מחיקת ההערה: Good coffee, quiet' }));
    expect(within(list).queryByText('Good coffee, quiet')).toBeNull();
  });

  it('removes the place and opens Google details', async () => {
    const { store, place } = await saved();
    const onShowDetails = vi.fn();
    const seen = vi.fn();
    store.watchPlaces(seen, vi.fn());
    render(<SavedPlaceCard store={store} place={place} onShowDetails={onShowDetails} />);
    await userEvent.click(screen.getByRole('button', { name: 'פרטים מגוגל' }));
    expect(onShowDetails).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'הסרת המקום' }));
    expect(seen).toHaveBeenLastCalledWith([]);
  });
});

describe('CandidateCard', () => {
  it('shows a save error and lets the user retry', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('permission denied')));
    render(<CandidateCard place={cafe} onSave={onSave} onShowDetails={vi.fn()} onCancel={vi.fn()} />);
    const save = screen.getByRole('button', { name: 'שמירה כמקום מעניין' });
    await userEvent.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied');
    expect(save).toBeEnabled();
  });
});
