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

/** Show/hide toggles for each line and for Israel Railways. */
export function Legend(props: LegendProps) {
  return (
    <div className="legend" role="group" aria-label="מקרא">
      {LINE_IDS.map((id) => (
        <Toggle key={id} id={id} label={LINES[id].name} swatch={{ background: LINES[id].color }} {...props} />
      ))}
      <Toggle id="rail" label="רכבת ישראל (פועלת)" swatch={undefined} {...props} />
    </div>
  );
}
