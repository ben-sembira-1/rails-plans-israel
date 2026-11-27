import type { LatLng } from '../data/schema.ts';
import { changeText, type Change } from '../domain/changes.ts';
import { LINES } from '../domain/lines.ts';
import { formatTime } from '../domain/time.ts';
import { formatCount } from './format.ts';

/**
 * What changed on the map since the previous time the user looked at, over the map. Each line zooms the map to its
 * sections. It stays until closed or until the time changes again.
 */
export function ChangeNote({
  from,
  to,
  changes,
  sitesDelta,
  onFocus,
  onClose,
}: {
  from: number;
  to: number;
  changes: readonly Change[];
  /** The change in active building sites, when the construction layer is loaded. */
  sitesDelta: { readonly now: number; readonly delta: number } | null;
  onFocus: (points: readonly LatLng[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="change-note" role="status" aria-label="מה השתנה">
      <div className="change-head">
        <b>
          מה השתנה ב־<span dir="ltr">{formatTime(to)}</span>
        </b>
        <span className="muted">
          לעומת <span dir="ltr">{formatTime(from)}</span>
        </span>
        <button type="button" className="icon-btn small" aria-label="סגירת ההודעה" onClick={onClose}>
          ✕
        </button>
      </div>
      <ul>
        {changes.map((c) => (
          <li key={`${c.line}-${c.kind}`}>
            <button
              type="button"
              className={`change change-${c.kind}`}
              style={{ '--line': LINES[c.line].color } as React.CSSProperties}
              title="הצגה במפה"
              onClick={() => {
                onFocus(c.points);
              }}
            >
              {changeText(c)}
            </button>
          </li>
        ))}
        {sitesDelta !== null && sitesDelta.delta !== 0 && (
          <li className="change-city">
            אתרי בנייה פעילים בתל אביב–יפו: {formatCount(sitesDelta.now)} (
            <span dir="ltr">
              {sitesDelta.delta > 0 ? '+' : '−'}
              {formatCount(Math.abs(sitesDelta.delta))}
            </span>
            )
          </li>
        )}
      </ul>
    </div>
  );
}
