import { useId, useMemo, useState } from 'react';
import type { Section, Site } from '../data/schema.ts';
import { eventLabel, MILESTONES, milestoneAt } from '../domain/events.ts';
import { markersFor, markerPosition, type Marker } from '../domain/markers.ts';
import { worksAt } from '../domain/status.ts';
import { formatTime, nearestStepIndex, STEPS, TODAY } from '../domain/time.ts';

export interface TimelineDockProps {
  readonly time: number;
  /** Every marker time on the timeline (works events and milestones), sorted. */
  readonly events: readonly number[];
  readonly sections: readonly Section[];
  readonly sites: readonly Site[];
  readonly onTimeChange: (t: number) => void;
}

/** "הסגול – אלנבי" -> "הסגול: אלנבי", to keep the works lists short. */
function shortName(name: string): string {
  return name.replace(/^(הסגול|הירוק|הקו האדום) – /, '$1: ');
}

function WorksList({ title, names, kind }: { title: string; names: readonly string[]; kind: string }) {
  return (
    <div className={`works works-${kind}`}>
      <b>{title}:</b>{' '}
      {names.length === 0 ? 'אין' : <span className="works-names">{names.map(shortName).join(' · ')}</span>}
    </div>
  );
}

function TimelineTrack({
  time,
  markers,
  onTimeChange,
}: Pick<TimelineDockProps, 'time' | 'onTimeChange'> & { markers: readonly Marker[] }) {
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

export function TimelineDock({ time, events, sections, sites, onTimeChange }: TimelineDockProps) {
  const [expanded, setExpanded] = useState(false);
  const moreId = useId();
  const markers = useMemo(() => markersFor(events), [events]);
  const milestone = milestoneAt(time);
  const works = worksAt(sections, sites, time);
  const label = eventLabel(time);
  const prev = markers.findLast((m) => m.time < time);
  const next = markers.find((m) => m.time > time);

  return (
    <section className={expanded ? 'dock expanded' : 'dock'} aria-label="ציר זמן">
      <div className="dock-bar">
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
        <TimelineTrack time={time} markers={markers} onTimeChange={onTimeChange} />
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
        <output className="now" dir="ltr">
          {formatTime(time)}
        </output>
      </div>

      <div className="caption-row">
        <div className="caption">
          {milestone ? milestone.caption : `${formatTime(time)}${label === undefined ? '' : ` · ${label}`}`}
        </div>
        <button
          type="button"
          className="dock-toggle"
          aria-expanded={expanded}
          aria-controls={moreId}
          onClick={() => {
            setExpanded((e) => !e);
          }}
        >
          אירועים ופרטים {expanded ? '▾' : '▴'}
        </button>
      </div>

      <div className="dock-more" id={moreId}>
        <div className="jump-lists">
          <div className="row-label">אבני דרך</div>
          <div className="milestones" role="group" aria-label="אבני דרך">
            {MILESTONES.map((m) => (
              <button
                type="button"
                key={m.time}
                className={m.time === time ? 'on' : undefined}
                aria-pressed={m.time === time}
                onClick={() => {
                  onTimeChange(m.time);
                }}
              >
                <span dir="auto">{m.label}</span>
              </button>
            ))}
          </div>
          <div className="row-label">שינויי מצב עבודות</div>
          <div className="events" role="group" aria-label="שינויי מצב עבודות">
            {events.map((t) => {
              const classes = [t === time ? 'on' : '', t === TODAY ? 'today' : ''].filter(Boolean).join(' ');
              return (
                <button
                  type="button"
                  key={t}
                  className={classes || undefined}
                  aria-pressed={t === time}
                  onClick={() => {
                    onTimeChange(t);
                  }}
                >
                  <b dir="ltr">{formatTime(t)}</b> {eventLabel(t)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="summary">
          {milestone && <div>{milestone.description}</div>}
          <WorksList title="עבודות כבדות" names={works.major} kind="major" />
          <WorksList title="עבודות קלות" names={works.minor} kind="minor" />
        </div>
        <p className="hint">
          קו מלא = פועל · קו מקווקו עם רצועה = בעבודות · קו מנוקד = בתכנון. לחיצה על קטע מציגה את כל שלביו.
        </p>
      </div>
    </section>
  );
}
