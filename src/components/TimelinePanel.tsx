import type { Section, Site } from '../data/schema.ts';
import { eventLabel, MILESTONES, milestoneAt } from '../domain/events.ts';
import { worksAt } from '../domain/status.ts';
import { formatTime, nearestStepIndex, STEPS, TODAY } from '../domain/time.ts';

export interface TimelinePanelProps {
  readonly time: number;
  readonly events: readonly number[];
  readonly sections: readonly Section[];
  readonly sites: readonly Site[];
  readonly playing: boolean;
  readonly onTimeChange: (t: number) => void;
  readonly onTogglePlay: () => void;
  readonly children?: React.ReactNode;
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

export function TimelinePanel(props: TimelinePanelProps) {
  const { time, events, sections, sites, playing, onTimeChange, onTogglePlay, children } = props;
  const milestone = milestoneAt(time);
  const works = worksAt(sections, sites, time);
  const label = eventLabel(time);

  return (
    <section className="panel timeline" aria-label="ציר זמן">
      <h1>
        הרכבת הקלה, המטרו ורכבת ישראל – מתי נפתח מה{' '}
        <span className="version" dir="ltr">
          v{__APP_VERSION__}
        </span>
      </h1>
      <p className="hint">
        גררו את ציר הזמן או בחרו אירוע. קו מלא = פועל · קו מקווקו עם רצועה = בעבודות · קו מנוקד = בתכנון.
        לחיצה על קטע מציגה את כל שלביו.
      </p>
      <div className="row">
        <button
          type="button"
          className="play"
          aria-label={playing ? 'עצירה' : 'הפעלה'}
          aria-pressed={playing}
          onClick={onTogglePlay}
        >
          {playing ? '❚❚' : '▶'}
        </button>
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
        <output className="now" dir="ltr">
          {formatTime(time)}
        </output>
      </div>

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
              title={eventLabel(t)}
              onClick={() => {
                onTimeChange(t);
              }}
            >
              <b dir="ltr">{formatTime(t)}</b> {eventLabel(t)}
            </button>
          );
        })}
      </div>

      <div className="caption">
        {milestone ? milestone.caption : `${formatTime(time)}${label === undefined ? '' : ` · ${label}`}`}
      </div>
      <div className="summary">
        {milestone && <div>{milestone.description}</div>}
        <WorksList title="עבודות כבדות" names={works.major} kind="major" />
        <WorksList title="עבודות קלות" names={works.minor} kind="minor" />
      </div>
      {children}
    </section>
  );
}
