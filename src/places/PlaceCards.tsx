import { useState } from 'react';
import { MAX_COMMENT_LENGTH, type NewPlace, type PlacesStore, type SavedPlace } from './types.ts';
import { useComments } from './usePlaces.ts';

const dateFormat = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' });

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A search result (or a clicked point of interest) that isn't saved yet. */
export function CandidateCard({
  place,
  onSave,
  onShowDetails,
  onCancel,
}: {
  place: NewPlace;
  onSave: () => Promise<void>;
  onShowDetails: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <div className="place-card" role="group" aria-label={place.name}>
      <b dir="auto">{place.name}</b>
      {place.address !== '' && (
        <div className="muted" dir="auto">
          {place.address}
        </div>
      )}
      <div className="place-actions">
        <button
          type="button"
          className="btn primary small"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            setError(null);
            onSave().catch((e: unknown) => {
              setError(errorText(e));
              setSaving(false);
            });
          }}
        >
          שמירה כמקום מעניין
        </button>
        <button type="button" className="btn small" onClick={onShowDetails}>
          פרטים מגוגל
        </button>
        <button type="button" className="btn small" onClick={onCancel}>
          ביטול
        </button>
      </div>
      {error !== null && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** A saved place: its comments, a form to add one, Google details and removal. */
export function SavedPlaceCard({
  store,
  place,
  onShowDetails,
}: {
  store: PlacesStore;
  place: SavedPlace;
  onShowDetails: () => void;
}) {
  const comments = useComments(store, place.id);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<void>, after?: () => void) => {
    setError(null);
    p.then(after).catch((e: unknown) => {
      setError(errorText(e));
    });
  };

  return (
    <div className="place-card" role="group" aria-label={place.name}>
      <b dir="auto">{place.name}</b>
      {place.address !== '' && (
        <div className="muted" dir="auto">
          {place.address}
        </div>
      )}

      <ul className="comments" aria-label="הערות">
        {comments.items.length === 0 && <li className="muted">אין הערות עדיין.</li>}
        {comments.items.map((c) => (
          <li key={c.id}>
            <span dir="auto" className="comment-text">
              {c.text}
            </span>
            {c.createdAt && <span className="muted">{dateFormat.format(c.createdAt)}</span>}
            <button
              type="button"
              className="link-btn"
              aria-label={`מחיקת ההערה: ${c.text}`}
              onClick={() => {
                run(store.removeComment(place.id, c.id));
              }}
            >
              מחיקה
            </button>
          </li>
        ))}
      </ul>

      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(store.addComment(place.id, draft), () => {
            setDraft('');
          });
        }}
      >
        <textarea
          aria-label="הערה חדשה"
          placeholder="הוספת הערה…"
          value={draft}
          maxLength={MAX_COMMENT_LENGTH}
          rows={2}
          dir="auto"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
        />
        <button type="submit" className="btn primary small" disabled={draft.trim() === ''}>
          הוספה
        </button>
      </form>

      <div className="place-actions">
        <button type="button" className="btn small" onClick={onShowDetails}>
          פרטים מגוגל
        </button>
        <button
          type="button"
          className="btn danger small"
          onClick={() => {
            run(store.removePlace(place.id));
          }}
        >
          הסרת המקום
        </button>
      </div>
      {(error ?? comments.error) !== null && (
        <div className="admin-error" role="alert">
          {error ?? comments.error}
        </div>
      )}
    </div>
  );
}
