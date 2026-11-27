import type { SavedPlace } from './types.ts';

/** The side panel's list of saved places. */
export function PlacesList({
  places,
  error,
  selectedId,
  onSelect,
  onSearch,
}: {
  places: readonly SavedPlace[];
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Moves the focus to the map's search box. */
  onSearch?: () => void;
}) {
  return (
    <section className="side-section" aria-label="מקומות מעניינים">
      <h2>מקומות מעניינים</h2>
      {error !== null && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {places.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            ★
          </span>
          <p>
            אין עדיין מקומות שמורים. חפשו מקום בתיבת החיפוש שעל המפה, או לחצו על נקודת עניין במפה, ובחרו
            ״שמירה כמקום מעניין״.
          </p>
          {onSearch && (
            <button type="button" className="btn" onClick={onSearch}>
              חיפוש מקום
            </button>
          )}
        </div>
      ) : (
        <ul className="places-list">
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={p.id === selectedId ? 'place-item on' : 'place-item'}
                aria-pressed={p.id === selectedId}
                onClick={() => {
                  onSelect(p.id);
                }}
              >
                <span className="place-pin" aria-hidden="true">
                  ★
                </span>
                <span className="place-text">
                  <b dir="auto">{p.name}</b>
                  {p.address !== '' && (
                    <span className="muted" dir="auto">
                      {p.address}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
