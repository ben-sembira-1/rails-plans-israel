import type { Section, Site } from '../data/schema.ts';
import { eventLabel, MILESTONES, milestoneAt } from '../domain/events.ts';
import type { LayerId } from '../domain/lines.ts';
import { worksAt } from '../domain/status.ts';
import { formatTime, TODAY } from '../domain/time.ts';
import { Legend } from './Legend.tsx';

export interface SidePanelProps {
  readonly id: string;
  /** The open tab, or `null` when the panel is closed (only the tab headers show on desktop). */
  readonly tab: PanelTab | null;
  /** Clicking the open tab's header closes the panel. */
  readonly onTab: (tab: PanelTab | null) => void;
  readonly time: number;
  readonly events: readonly number[];
  readonly sections: readonly Section[];
  readonly sites: readonly Site[];
  readonly hidden: ReadonlySet<LayerId>;
  readonly onTimeChange: (t: number) => void;
  readonly onToggleLayer: (id: LayerId, visible: boolean) => void;
  /** The places-of-interest tab; without it the panel shows only the trains information. */
  readonly places?: { readonly count: number; readonly content: React.ReactNode };
}

export type PanelTab = 'trains' | 'places';

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

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="side-section" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** All the controls and the documentation: current status, events, layers and how to read the map. */
export function SidePanel({
  id,
  tab,
  onTab,
  time,
  events,
  sections,
  sites,
  hidden,
  onTimeChange,
  onToggleLayer,
  places,
}: SidePanelProps) {
  const milestone = milestoneAt(time);
  const works = worksAt(sections, sites, time);
  const shown: PanelTab | null = tab === 'places' && !places ? 'trains' : tab;

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
    <aside id={id} className={shown ? 'side-panel open' : 'side-panel'} aria-label="לוח בקרה">
      <div className="tabs" role="tablist" aria-label="תוכן הלוח">
        {tabButton('trains', 'מידע על הרכבות')}
        {places && tabButton('places', `מקומות מעניינים (${String(places.count)})`)}
      </div>
      {shown === null ? null : shown === 'places' && places ? (
        <div role="tabpanel" id={`${id}-places`} aria-labelledby={`${id}-tab-places`}>
          {places.content}
        </div>
      ) : (
        <div role="tabpanel" id={`${id}-trains`} aria-labelledby={`${id}-tab-trains`}>
          <PanelSection title={`המצב ב־${formatTime(time)}`}>
            <div className="summary">
              {milestone && <p className="milestone-text">{milestone.description}</p>}
              <WorksList title="עבודות כבדות" names={works.major} kind="major" />
              <WorksList title="עבודות קלות" names={works.minor} kind="minor" />
            </div>
          </PanelSection>

          <PanelSection title="אבני דרך">
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
          </PanelSection>

          <PanelSection title="שינויי מצב עבודות">
            <div className="events" role="group" aria-label="שינויי מצב עבודות">
              {events.map((t) => {
                const classes = [t === time ? 'on' : '', t === TODAY ? 'today' : '']
                  .filter(Boolean)
                  .join(' ');
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
          </PanelSection>

          <PanelSection title="שכבות">
            <Legend hidden={hidden} onToggle={onToggleLayer} />
          </PanelSection>

          <PanelSection title="איך לקרוא את המפה">
            <ul className="docs">
              <li>
                <span className="line-sample solid" /> קו מלא – פועל.
              </li>
              <li>
                <span className="line-sample dashed" /> קו מקווקו עם רצועה – בעבודות.
              </li>
              <li>
                <span className="line-sample dotted" /> קו מנוקד – בתכנון.
              </li>
              <li>
                <span className="zone zone-major">
                  <i />
                </span>{' '}
                עבודות כבדות ·{' '}
                <span className="zone zone-minor">
                  <i />
                </span>{' '}
                עבודות קלות. רצועה כהה: עד 20 מ׳ מהקו (פגיעה חזקה); בהירה: 20–100 מ׳.
              </li>
              <li>לחיצה על קטע מציגה את כל שלביו; לחיצה על תחנה מציגה את מועד הפתיחה.</li>
              <li>שמות התחנות מופיעים בזום קרוב. קווי המטרו משורטטים בקו ישר בין תחנות.</li>
              <li>
                הציר מתקדם ברבעונים עד 2029 ובשנים מ־2030; מצב העבודות לפי הלו״ז שפורסם, ואחרי 2030 בדיוק של
                שנה.
              </li>
            </ul>
            <p className="sources">
              מקורות: מינהל התכנון (שכבות תמ״א 70 ו״חצב״), נת״ע, ויקיפדיה, OpenStreetMap.
            </p>
          </PanelSection>
        </div>
      )}
    </aside>
  );
}
