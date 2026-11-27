import { useState } from 'react';
import type { ConstructionState } from '../construction/useConstruction.ts';
import { CLUSTER_COLOR } from '../construction/style.ts';
import type { Network } from '../data/schema.ts';
import type { ConstructionLayer } from '../domain/construction.ts';
import { eventLabel, milestoneAt } from '../domain/events.ts';
import { LINE_IDS, LINES } from '../domain/lines.ts';
import type { Marker } from '../domain/markers.ts';
import { shortName } from '../domain/names.ts';
import { LINE_STATE_LABEL, lineStatusAt } from '../domain/status.ts';
import { formatTime, TODAY } from '../domain/time.ts';
import { RAIL_INNER_M, RAIL_OUTER_M, SITE_HIGH_NOISE_M, SITE_LOW_NOISE_M } from '../domain/zones.ts';
import { formatCount, formatDate } from './format.ts';
import { SNAP_PX, useSheetDrag } from './useSheetDrag.ts';

export type PanelTab = 'trains' | 'places';

export interface SidePanelProps {
  readonly id: string;
  /** The open tab, or `null` when the panel is closed (only the tab headers show). */
  readonly tab: PanelTab | null;
  /** Clicking the open tab's header closes the panel. */
  readonly onTab: (tab: PanelTab | null) => void;
  /** The tab to open from the phone sheet's handle. */
  readonly lastTab: PanelTab;
  readonly time: number;
  /** Every event on the timeline, sorted (the same as the bar's markers). */
  readonly markers: readonly Marker[];
  readonly network: Network;
  readonly onTimeChange: (t: number) => void;
  /** City construction: the snapshot and its counts at the selected time; without it they are not mentioned. */
  readonly construction?: {
    readonly state: ConstructionState;
    readonly counts: Readonly<Record<ConstructionLayer, number>> | null;
  };
  readonly onAbout: () => void;
  /** The places-of-interest tab; without it the panel shows only the trains information. */
  readonly places?: { readonly count: number; readonly content: React.ReactNode };
}

function PanelSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `side-section ${className}` : 'side-section'} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** One row per line: its color, its state in a word, how much of it runs / is under works, and where. */
function LineRows({ network, time }: { network: Network; time: number }) {
  return (
    <ul className="line-rows" aria-label="מצב הקווים">
      {LINE_IDS.map((id) => {
        const s = lineStatusAt(network.sections, network.sites, id, time);
        const names = [...s.major, ...s.minor];
        return (
          <li key={id} className="line-row" style={{ '--line': LINES[id].color } as Style}>
            <div className="line-row-head">
              <span className="line-name">{LINES[id].name}</span>
              <span className={`state state-${s.state}`}>{LINE_STATE_LABEL[s.state]}</span>
            </div>
            <div
              className="share"
              role="img"
              aria-label={`${String(Math.round(s.share.open * 100))}% מהקו פועל, ${String(
                Math.round((s.share.major + s.share.minor) * 100),
              )}% בעבודות`}
            >
              {(['open', 'major', 'minor', 'none'] as const).map((k) =>
                s.share[k] > 0 ? (
                  <span key={k} className={`share-${k}`} style={{ flexGrow: s.share[k] }} />
                ) : null,
              )}
            </div>
            {names.length > 0 && (
              <details className="where">
                <summary>
                  {[
                    s.major.length > 0 && `${String(s.major.length)} בעבודות כבדות`,
                    s.minor.length > 0 && `${String(s.minor.length)} בעבודות קלות`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </summary>
                <ul>
                  {s.major.map((n) => (
                    <li key={n} className="where-major">
                      {shortName(n)}
                    </li>
                  ))}
                  {s.minor.map((n) => (
                    <li key={n} className="where-minor">
                      {shortName(n)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** City construction at the selected time, as three figures with the map's own swatches. */
function CityFigures({ construction }: { construction: NonNullable<SidePanelProps['construction']> }) {
  const { state, counts } = construction;
  if (state.status === 'loading') {
    return (
      <div className="figures" aria-busy="true" aria-label="טוען את נתוני הבנייה">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    );
  }
  if (state.status === 'missing' || counts === null) {
    return <p className="note">נתוני הבנייה לא זמינים כרגע. שאר המפה מעודכנת.</p>;
  }
  const figures: readonly [ConstructionLayer, string][] = [
    ['construction', 'אתרי בנייה פעילים'],
    ['permitted', 'היתרים שטרם החלו'],
    ['road', 'עבודות כביש'],
  ];
  return (
    <dl className="figures">
      {figures.map(([layer, label]) => (
        <div key={layer} className="figure">
          <dt>
            <span className={`fig-swatch fig-${layer}`} style={{ '--c': CLUSTER_COLOR[layer] } as Style} />
            {label}
          </dt>
          <dd>{formatCount(counts[layer])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Every event, as a vertical timeline; clicking one moves the map to it. */
function EventList({
  markers,
  time,
  onTimeChange,
}: {
  markers: readonly Marker[];
  time: number;
  onTimeChange: (t: number) => void;
}) {
  return (
    <div className="event-list" role="group" aria-label="ציר האירועים">
      {markers.map((m) => {
        const on = m.time === time;
        const classes = ['event', m.kind, on ? 'on' : ''].filter(Boolean).join(' ');
        return (
          <button
            type="button"
            key={m.time}
            className={classes}
            aria-pressed={on}
            onClick={() => {
              onTimeChange(m.time);
            }}
          >
            <span className="ev-dot" aria-hidden="true" />
            <b className="ev-date" dir="ltr">
              {formatTime(m.time)}
            </b>
            <span className="ev-label">
              {m.time === TODAY
                ? 'היום'
                : (eventLabel(m.time) ?? milestoneAt(m.time)?.label ?? 'שינוי בעבודות')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const KEY_OPEN = 'map-key-open';

function readKeyOpen(): boolean {
  try {
    return window.localStorage.getItem(KEY_OPEN) !== 'false';
  } catch {
    return true;
  }
}

/** How to read the map: a sample of every style, with a short explanation. */
function MapKey({ construction }: { construction: boolean }) {
  const [open, setOpen] = useState(readKeyOpen);
  return (
    <details
      className="side-section map-key"
      open={open}
      onToggle={(e) => {
        const now = e.currentTarget.open;
        setOpen(now);
        try {
          window.localStorage.setItem(KEY_OPEN, String(now));
        } catch {
          // Without storage the key just opens by default next time.
        }
      }}
    >
      <summary>
        <h2>איך לקרוא את המפה</h2>
      </summary>
      <section aria-label="איך לקרוא את המפה">
        <ul className="key">
          <li>
            <span className="k-line solid" /> קו מלא: פועל
          </li>
          <li>
            <span className="k-line dashed" /> קו מקווקו: בעבודות
          </li>
          <li>
            <span className="k-line dotted" /> קו מנוקד: בתכנון
          </li>
          <li>
            <span className="k-zone k-major">
              <i />
            </span>
            עבודות כבדות: כהה עד {RAIL_INNER_M} מ׳ מהקו, בהיר עד {RAIL_OUTER_M} מ׳
          </li>
          <li>
            <span className="k-zone k-minor">
              <i />
            </span>
            עבודות קלות ואתרי הכנה של המטרו
          </li>
          <li>
            <span className="k-stn" />
            <span className="k-stn fut" /> תחנה; עם טבעת מקווקוות: תחנה עתידית
          </li>
          <li>
            <span className="k-rail" /> רכבת ישראל
          </li>
          {construction && (
            <>
              <li>
                <span className="k-zone k-build">
                  <i />
                </span>
                אתר בנייה פעיל: רעש חזק עד {SITE_HIGH_NOISE_M} מ׳, חלש עד {SITE_LOW_NOISE_M} מ׳
              </li>
              <li>
                <span className="k-outline permit" /> היתר בנייה שטרם החל
              </li>
              <li>
                <span className="k-outline request" /> בקשה להיתר (מוסתר כברירת מחדל)
              </li>
              <li>
                <span className="k-road" /> עבודות כביש
              </li>
              <li>
                <span className="k-bubble">12</span> כמה פרויקטים באזור; לחיצה מגדילה את המפה
              </li>
            </>
          )}
        </ul>
        <p className="hint">לחיצה על קטע, תחנה או פרויקט מציגה את פרטיו ואת השלבים שלו.</p>
      </section>
    </details>
  );
}

/** Where the data comes from, how fresh it is, and that the site isn't official. */
function Provenance({
  updated,
  construction,
  onAbout,
}: {
  updated: string;
  construction: ConstructionState | undefined;
  onAbout: () => void;
}) {
  return (
    <footer className="provenance">
      <p>
        נתוני הרכבות נכונים ל־{formatDate(updated)}
        {construction?.status === 'ready' && (
          <>; נתוני הבנייה עודכנו ב־{formatDate(construction.data.fetchedAt)}</>
        )}
        .
      </p>
      <p>
        מקורות: מינהל התכנון, נת״ע, עיריית תל אביב–יפו ו־OpenStreetMap.{' '}
        <button type="button" className="link" onClick={onAbout}>
          עוד על המפה ועל המקורות
        </button>
      </p>
      <p className="disclaimer">האתר אינו אתר רשמי של נת״ע, של משרד התחבורה או של העירייה.</p>
    </footer>
  );
}

type Snap = 'peek' | 'half' | 'full';

/**
 * The trains information (status, events, how to read the map, sources) and the places tab. On desktop it is the
 * left column; on a phone it is a bottom sheet with a handle: peek (tabs only), half, or full.
 */
export function SidePanel({
  id,
  tab,
  onTab,
  lastTab,
  time,
  markers,
  network,
  onTimeChange,
  construction,
  onAbout,
  places,
}: SidePanelProps) {
  const milestone = milestoneAt(time);
  const shown: PanelTab | null = tab === 'places' && !places ? 'trains' : tab;
  const [full, setFull] = useState(false);
  const snap: Snap = shown === null ? 'peek' : full ? 'full' : 'half';

  const toSnap = (s: Snap) => {
    setFull(s === 'full');
    if (s === 'peek') onTab(null);
    else if (shown === null) onTab(lastTab);
  };
  const order: readonly Snap[] = ['peek', 'half', 'full'];
  const { dy, handlers } = useSheetDrag(
    (d) => {
      const i = order.indexOf(snap);
      if (d < -SNAP_PX) toSnap(order[Math.min(i + 1, 2)] ?? snap);
      else if (d > SNAP_PX) toSnap(order[Math.max(i - 1, 0)] ?? snap);
    },
    () => {
      toSnap(snap === 'peek' ? 'half' : 'peek');
    },
  );

  const tabButton = (value: PanelTab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`${id}-tab-${value}`}
      aria-selected={shown === value}
      aria-controls={`${id}-${value}`}
      className={shown === value ? 'tab on' : 'tab'}
      onClick={() => {
        onTab(shown === value ? null : value);
      }}
    >
      {label}
    </button>
  );

  return (
    <aside
      id={id}
      className={`side-panel sheet-${snap}${dy !== 0 ? ' dragging' : ''}`}
      style={{ '--drag': `${String(dy)}px` } as Style}
      aria-label="לוח בקרה"
    >
      <button
        type="button"
        className="sheet-handle"
        aria-expanded={shown !== null}
        aria-controls={id}
        aria-label={shown === null ? 'פתיחת לוח המידע' : 'סגירת לוח המידע'}
        {...handlers}
      >
        <span aria-hidden="true" />
      </button>
      <div className="tabs" role="tablist" aria-label="תוכן הלוח">
        {tabButton('trains', 'מידע על הרכבות')}
        {places && tabButton('places', `מקומות מעניינים (${String(places.count)})`)}
      </div>
      {shown === null ? null : shown === 'places' && places ? (
        <div role="tabpanel" id={`${id}-places`} aria-labelledby={`${id}-tab-places`} className="panel-body">
          {places.content}
        </div>
      ) : (
        <div role="tabpanel" id={`${id}-trains`} aria-labelledby={`${id}-tab-trains`} className="panel-body">
          <PanelSection title={`המצב ב־${formatTime(time)}`}>
            {milestone && <p className="milestone-text">{milestone.description}</p>}
            <LineRows network={network} time={time} />
          </PanelSection>

          {construction && (
            <PanelSection title="בנייה ועבודות בתל אביב–יפו">
              <CityFigures construction={construction} />
            </PanelSection>
          )}

          <PanelSection title="ציר האירועים">
            <EventList markers={markers} time={time} onTimeChange={onTimeChange} />
          </PanelSection>

          <MapKey construction={construction !== undefined} />

          <Provenance updated={network.updated} construction={construction?.state} onAbout={onAbout} />
        </div>
      )}
    </aside>
  );
}
