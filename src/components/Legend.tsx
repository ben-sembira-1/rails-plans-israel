import { LINE_IDS, LINES, type LayerId, type LineId } from '../domain/lines.ts';

export interface LegendProps {
  readonly hidden: ReadonlySet<LayerId>;
  readonly onToggle: (id: LayerId, visible: boolean) => void;
  /** Hovering or focusing a line highlights it on the map (`null` when leaving). */
  readonly onHighlight?: (id: LineId | null) => void;
  /** Zooms the map to a line. */
  readonly onFocusLine?: (id: LineId) => void;
}

/** Show/hide toggles for each line and for Israel Railways; each line can also be highlighted and zoomed to. */
export function Legend({ hidden, onToggle, onHighlight, onFocusLine }: LegendProps) {
  return (
    <div className="legend" role="group" aria-label="מקרא">
      {LINE_IDS.map((id) => (
        <div
          key={id}
          className="layer-row-wrap"
          onMouseEnter={() => onHighlight?.(id)}
          onMouseLeave={() => onHighlight?.(null)}
          onFocus={() => onHighlight?.(id)}
          onBlur={() => onHighlight?.(null)}
        >
          <label className="layer-row">
            <input
              type="checkbox"
              checked={!hidden.has(id)}
              onChange={(e) => {
                onToggle(id, e.target.checked);
              }}
            />
            <span className="swatch" style={{ background: LINES[id].color }} aria-hidden="true" />
            <span className="layer-name">{LINES[id].name}</span>
          </label>
          {onFocusLine && (
            <button
              type="button"
              className="icon-btn small"
              aria-label={`התמקדות ב${LINES[id].name}`}
              title="הצגת כל הקו במפה"
              onClick={() => {
                onFocusLine(id);
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="4.5" />
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <label className="layer-row">
        <input
          type="checkbox"
          checked={!hidden.has('rail')}
          onChange={(e) => {
            onToggle('rail', e.target.checked);
          }}
        />
        <span className="swatch rail" aria-hidden="true" />
        <span className="layer-name">רכבת ישראל (פועלת)</span>
      </label>
    </div>
  );
}
