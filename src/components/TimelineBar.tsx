import { eventLabel, milestoneAt } from '../domain/events.ts';
import { markerPosition, type Marker } from '../domain/markers.ts';
import { adjacentSteps, formatTime, nearestStepIndex, STEPS } from '../domain/time.ts';

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
              className={['marker', m.kind === 'milestone' ? 'main' : m.kind, m.side, m.edge, on ? 'on' : '']
                .filter(Boolean)
                .join(' ')}
              style={{ '--pos': markerPosition(m.time) } as React.CSSProperties}
              aria-label={`${formatTime(m.time)} · ${m.label}`}
              aria-pressed={on}
              title={`${formatTime(m.time)} · ${m.label}`}
              tabIndex={m.kind === 'today' ? 0 : -1}
              onClick={() => {
                onTimeChange(m.time);
              }}
            >
              {m.kind !== 'event' && (
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

/**
 * The timeline: previous/next, the current time and caption, then the bar with its markers. On desktop it heads
 * the side panel; on narrow screens it spans the page under the top strip.
 */
export function TimelineBar({
  time,
  markers,
  onTimeChange,
  panelOpen,
  panelId,
  onTogglePanel,
}: TimelineBarProps) {
  // Previous / next move one step of the grid (a quarter, or a year from YEARLY_FROM); events are only markers.
  const { prev, next } = adjacentSteps(time);
  const stepTitle = (t: number | undefined) =>
    t === undefined ? undefined : [formatTime(t), eventLabel(t)].filter(Boolean).join(' · ');
  const milestone = milestoneAt(time);
  const label = eventLabel(time);
  // The time itself is shown next to the buttons.
  const caption = milestone?.caption ?? label ?? '';

  return (
    <section className="timeline" aria-label="ציר זמן">
      <div className="timeline-row">
        <div className="steps" role="group" aria-label="מעבר בציר הזמן">
          <button
            type="button"
            className="step-btn"
            aria-label="צעד אחורה"
            title={stepTitle(prev)}
            disabled={prev === undefined}
            onClick={() => {
              if (prev !== undefined) onTimeChange(prev);
            }}
          >
            →
          </button>
          <button
            type="button"
            className="step-btn"
            aria-label="צעד קדימה"
            title={stepTitle(next)}
            disabled={next === undefined}
            onClick={() => {
              if (next !== undefined) onTimeChange(next);
            }}
          >
            ←
          </button>
        </div>
        <output className="now" dir="ltr">
          {formatTime(time)}
        </output>
        <div className="caption" title={caption}>
          {caption}
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
      <Track time={time} markers={markers} onTimeChange={onTimeChange} />
    </section>
  );
}
