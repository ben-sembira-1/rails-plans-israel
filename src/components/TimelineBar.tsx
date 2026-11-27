import { eventLabel, milestoneAt } from '../domain/events.ts';
import { markerPosition, type Marker } from '../domain/markers.ts';
import { formatTime, nearestStepIndex, STEPS } from '../domain/time.ts';

export interface TimelineBarProps {
  readonly time: number;
  /** Every event on the bar (works events and milestones), sorted by time. */
  readonly markers: readonly Marker[];
  readonly onTimeChange: (t: number) => void;
  /** Phone only: whether the side panel is open, and the toggle that opens it. */
  readonly panelOpen: boolean;
  readonly panelId: string;
  readonly onTogglePanel: () => void;
}

function Track({ time, markers, onTimeChange }: Pick<TimelineBarProps, 'time' | 'markers' | 'onTimeChange'>) {
  return (
    <div className="track">
      <input
        type="range"
        className="slider"
        aria-label="ציר זמן"
        aria-valuetext={formatTime(time)}
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={nearestStepIndex(time)}
        onChange={(e) => {
          const t = STEPS[Number(e.target.value)];
          if (t !== undefined) onTimeChange(t);
        }}
      />
      <div className="markers" role="group" aria-label="סמנים על ציר הזמן">
        {markers.map((m) => {
          const on = m.time === time;
          return (
            <button
              type="button"
              key={m.time}
              className={['marker', m.main ? 'main' : '', m.side ?? '', on ? 'on' : '']
                .filter(Boolean)
                .join(' ')}
              style={{ '--pos': markerPosition(m.time) } as React.CSSProperties}
              aria-label={`${formatTime(m.time)} · ${m.label}`}
              aria-pressed={on}
              title={`${formatTime(m.time)} · ${m.label}`}
              tabIndex={-1}
              onClick={() => {
                onTimeChange(m.time);
              }}
            >
              {m.main && (
                <span className="marker-label" dir="auto">
                  {m.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The timeline strip under the top bar: previous/next, the current time and the bar with its markers. */
export function TimelineBar({
  time,
  markers,
  onTimeChange,
  panelOpen,
  panelId,
  onTogglePanel,
}: TimelineBarProps) {
  const prev = markers.findLast((m) => m.time < time);
  const next = markers.find((m) => m.time > time);
  const milestone = milestoneAt(time);
  const label = eventLabel(time);

  return (
    <section className="timeline" aria-label="ציר זמן">
      <div className="timeline-row">
        <div className="steps" role="group" aria-label="מעבר בין אירועים">
          <button
            type="button"
            className="step-btn"
            aria-label="האירוע הקודם"
            title={prev ? `${formatTime(prev.time)} · ${prev.label}` : undefined}
            disabled={prev === undefined}
            onClick={() => {
              if (prev) onTimeChange(prev.time);
            }}
          >
            →
          </button>
          <button
            type="button"
            className="step-btn"
            aria-label="האירוע הבא"
            title={next ? `${formatTime(next.time)} · ${next.label}` : undefined}
            disabled={next === undefined}
            onClick={() => {
              if (next) onTimeChange(next.time);
            }}
          >
            ←
          </button>
        </div>
        <output className="now" dir="ltr">
          {formatTime(time)}
        </output>
        <Track time={time} markers={markers} onTimeChange={onTimeChange} />
      </div>
      <div className="caption-row">
        <div className="caption">
          {milestone ? milestone.caption : `${formatTime(time)}${label === undefined ? '' : ` · ${label}`}`}
        </div>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={panelOpen}
          aria-controls={panelId}
          onClick={onTogglePanel}
        >
          מקרא ואירועים {panelOpen ? '▴' : '▾'}
        </button>
      </div>
    </section>
  );
}
