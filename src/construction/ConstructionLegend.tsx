import {
  CONSTRUCTION_LAYER_LABEL,
  CONSTRUCTION_LAYERS,
  type ConstructionLayer,
} from '../domain/construction.ts';
import { formatCount } from '../components/format.ts';
import type { ConstructionState } from './useConstruction.ts';

export interface ConstructionPanelInfo {
  readonly state: ConstructionState;
  /** Projects of each layer at the selected time (also the hidden ones). */
  readonly counts: Readonly<Record<ConstructionLayer, number>> | null;
  readonly hidden: ReadonlySet<ConstructionLayer>;
  readonly onToggle: (layer: ConstructionLayer, visible: boolean) => void;
}

/** Show/hide toggles for the construction layers, with the number of projects at the selected time. */
export function ConstructionLegend({ state, counts, hidden, onToggle }: ConstructionPanelInfo) {
  if (state.status === 'loading') {
    return (
      <div className="legend" aria-busy="true" aria-label="טוען את נתוני הבנייה">
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    );
  }
  if (state.status === 'missing') return <p className="note">נתוני הבנייה לא זמינים כרגע.</p>;
  return (
    <div className="legend" role="group" aria-label="שכבות בנייה">
      {CONSTRUCTION_LAYERS.map((layer) => (
        <label key={layer} className="layer-row">
          <input
            type="checkbox"
            checked={!hidden.has(layer)}
            onChange={(e) => {
              onToggle(layer, e.target.checked);
            }}
          />
          <span className={`build-swatch build-${layer}`} aria-hidden="true" />
          <span className="layer-name">{CONSTRUCTION_LAYER_LABEL[layer]}</span>
          {counts && <span className="count">{formatCount(counts[layer])}</span>}
        </label>
      ))}
    </div>
  );
}
