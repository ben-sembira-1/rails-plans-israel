import { useEffect, useId, useRef, useState } from 'react';
import { ConstructionLegend, type ConstructionPanelInfo } from '../construction/ConstructionLegend.tsx';
import type { LineId } from '../domain/lines.ts';
import { Legend, type LegendProps } from './Legend.tsx';

/**
 * The layers picker: a button on the map, always visible, that opens the line and construction toggles. A dot on
 * the button says some layers are hidden.
 */
export function LayersControl({
  construction,
  ...legend
}: LegendProps & { readonly construction?: ConstructionPanelInfo }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const someHidden =
    legend.hidden.size > 0 ||
    (construction !== undefined && [...construction.hidden].some((l) => l !== 'requested'));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="layers-ctl" ref={root}>
      {open && (
        <div className="layers-pop" id={id} role="region" aria-label="שכבות">
          <h3>קווים</h3>
          <Legend
            {...legend}
            {...(legend.onFocusLine
              ? {
                  // Close the picker so it doesn't cover the line the map zooms to.
                  onFocusLine: (line: LineId) => {
                    setOpen(false);
                    legend.onHighlight?.(null);
                    legend.onFocusLine?.(line);
                  },
                }
              : {})}
          />
          {construction && (
            <>
              <h3>בנייה ועבודות בתל אביב–יפו</h3>
              <ConstructionLegend {...construction} />
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className={open ? 'map-ctl-btn on' : 'map-ctl-btn'}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3 2.5 7 10 11l7.5-4z" />
          <path d="m2.5 10.5 7.5 4 7.5-4M2.5 14l7.5 4 7.5-4" />
        </svg>
        שכבות
        {someHidden && <span className="ctl-dot" aria-label="חלק מהשכבות מוסתרות" />}
      </button>
    </div>
  );
}
