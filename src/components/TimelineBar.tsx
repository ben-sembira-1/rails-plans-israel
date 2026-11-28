import { useEffect, useState } from 'react';
import { eventLabel, milestoneAt } from '../domain/events.ts';
import { indexOfSlot, markerPosition, SLOT_COUNT, slotOf, type Marker } from '../domain/markers.ts';
import { adjacentSteps, formatTime, nearestStepIndex, STEPS, YEARLY_FROM } from '../domain/time.ts';

/** Play: time on each step, and a longer stop on an event so its caption can be read. */
export const PLAY_STEP_MS = 700;
export const PLAY_EVENT_MS = 1600;

export interface TimelineBarProps {
  readonly time: number;
  /** Every event on the bar (works events and milestones), sorted by time. */
  readonly markers: readonly Marker[];
  readonly onTimeChange: (t: number) => void;
}

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

function Track({
  time,
  markers,
  onTimeChange,
  onKey,
}: Pick<TimelineBarProps, 'time' | 'markers' | 'onTimeChange'> & {
  onKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const index = nearestStepIndex(time);
  return (
    <div className="track" style={{ '--p': markerPosition(time) } as Style}>
      {/* The visible bar: travelled part solid, the future dashed, a tick per quarter or year. */}
      <div className="rail" aria-hidden="true">
        <span className="rail-past" />
        <span className="rail-future" />
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={s >= YEARLY_FROM ? 'tick year' : 'tick'}
            style={{ '--pos': slotOf(i) / SLOT_COUNT } as Style}
          />
        ))}
      </div>
      <input
        type="range"
        className="slider"
        aria-label="ציר זמן"
        aria-valuetext={formatTime(time)}
        min={0}
        max={SLOT_COUNT}
        step={1}
        value={slotOf(index)}
        onKeyDown={onKey}
        onChange={(e) => {
          const t = STEPS[indexOfSlot(Number(e.target.value), index)];
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
              style={{ '--pos': markerPosition(m.time) } as Style}
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
      <span className="train" aria-hidden="true" />
    </div>
  );
}

/**
 * The timeline: play, previous/next, the current time and caption, then the bar drawn as a rail line with its
 * events as stops and the milestones as stations.
 */
export function TimelineBar({ time, markers, onTimeChange }: TimelineBarProps) {
  // Previous / next move one step of the grid (a quarter, or a year from YEARLY_FROM); events are only markers.
  const { prev, next } = adjacentSteps(time);
  const stepTitle = (t: number | undefined) =>
    t === undefined ? undefined : [formatTime(t), eventLabel(t)].filter(Boolean).join(' · ');
  const milestone = milestoneAt(time);
  const caption = milestone?.caption ?? eventLabel(time) ?? '';

  // Playing = the time is still the one the player set last; any other change of time stops it.
  const [playAt, setPlayAt] = useState<number | null>(null);
  const playing = playAt === time && next !== undefined;
  useEffect(() => {
    if (!playing) return undefined;
    const onEvent = markers.some((m) => m.time === time);
    const id = setTimeout(
      () => {
        setPlayAt(next);
        onTimeChange(next);
      },
      onEvent ? PLAY_EVENT_MS : PLAY_STEP_MS,
    );
    return () => {
      clearTimeout(id);
    };
  }, [playing, time, next, markers, onTimeChange]);

  const togglePlay = () => {
    if (playing) {
      setPlayAt(null);
      return;
    }
    // At the end, play again from the start.
    const start = next === undefined ? (STEPS[0] ?? time) : time;
    setPlayAt(start);
    if (start !== time) onTimeChange(start);
  };

  const jumpToEvent = (dir: 1 | -1) => {
    const target = dir === 1 ? markers.find((m) => m.time > time) : markers.findLast((m) => m.time < time);
    if (target) onTimeChange(target.time);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      jumpToEvent(e.key === 'PageUp' ? 1 : -1);
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    }
  };

  return (
    <section className="timeline" aria-label="ציר זמן">
      <div className="timeline-row">
        <button
          type="button"
          className={playing ? 'play-btn on' : 'play-btn'}
          aria-label={playing ? 'עצירת הניגון' : 'ניגון ציר הזמן'}
          aria-pressed={playing}
          title={playing ? 'עצירה' : 'ניגון: מעבר על כל הציר'}
          onClick={togglePlay}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3.5" y="3" width="3" height="10" rx="1" />
              <rect x="9.5" y="3" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {/* Pointing left: time runs right to left in Hebrew. */}
              <path d="M12 3.2v9.6a.6.6 0 0 1-.9.5L3.6 8.5a.6.6 0 0 1 0-1l7.5-4.8a.6.6 0 0 1 .9.5Z" />
            </svg>
          )}
        </button>
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
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
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
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
        </div>
        <output className="now" dir="ltr">
          {formatTime(time)}
        </output>
        <div className="caption" title={caption}>
          {caption}
        </div>
      </div>
      <Track time={time} markers={markers} onTimeChange={onTimeChange} onKey={onKey} />
    </section>
  );
}
