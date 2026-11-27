import { LINE_IDS, LINES, type LayerId } from '../domain/lines.ts';

export interface LegendProps {
  readonly hidden: ReadonlySet<LayerId>;
  readonly onToggle: (id: LayerId, visible: boolean) => void;
}

function Toggle({
  id,
  label,
  swatch,
  hidden,
  onToggle,
}: LegendProps & { id: LayerId; label: string; swatch: React.CSSProperties | undefined }) {
  return (
    <label>
      <input
        type="checkbox"
        checked={!hidden.has(id)}
        onChange={(e) => {
          onToggle(id, e.target.checked);
        }}
      />
      <span className={id === 'rail' ? 'swatch rail' : 'swatch'} style={swatch} />
      {label}
    </label>
  );
}

export function Legend(props: LegendProps) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
  return (
    <aside className="panel legend" aria-label="מקרא">
      <details open={!narrow}>
        <summary>מקרא</summary>
        <div className="zone-row">
          <span className="zone zone-major">
            <i />
          </span>
          עבודות כבדות
        </div>
        <div className="zone-row">
          <span className="zone zone-minor">
            <i />
          </span>
          עבודות קלות
        </div>
        <small>רצועה כהה: עד 20 מ׳ מהקו (פגיעה חזקה). רצועה בהירה: 20–100 מ׳.</small>
        {LINE_IDS.map((id) => (
          <Toggle
            key={id}
            id={id}
            label={LINES[id].name}
            swatch={{ background: LINES[id].color }}
            {...props}
          />
        ))}
        <Toggle id="rail" label="רכבת ישראל (פועלת)" swatch={undefined} {...props} />
        <small className="notes">
          שמות התחנות מופיעים בזום קרוב. קווי המטרו משורטטים בקו ישר בין תחנות. מצב העבודות לפי הלו״ז שפורסם;
          אחרי 2030 בדיוק של שנה. מקורות: מינהל התכנון (שכבות תמ״א 70 ו״חצב״), נת״ע, ויקיפדיה, OpenStreetMap.
        </small>
      </details>
    </aside>
  );
}
