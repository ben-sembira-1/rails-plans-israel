import type { Project } from '../data/construction.ts';
import { formatTime, stepBefore } from '../domain/time.ts';
import { formatDate } from '../components/format.ts';
import { Estimated, PopupFrame } from '../components/PopupFrame.tsx';
import { LAYER_COLOR, STATUS_TEXT } from './style.ts';

const SOURCE: Readonly<Record<string, string>> = { 'tel-aviv': 'עיריית תל אביב–יפו' };

/** "2025Q2–2026Q3": from a phase's start to the step before the next one (or before the end of works). */
function range(from: number, to: number | null): string {
  if (to === null) return `${formatTime(from)}–`;
  const last = stepBefore(to);
  return last <= from ? formatTime(from) : `${formatTime(from)}–${formatTime(last)}`;
}

/** How far the works are, by time: a thin bar in the building's color and the share in words. */
function Progress({ value, estimated }: { value: number; estimated: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="pop-progress">
      <div className="pop-progress-text">
        <span>
          עבר <b>{pct}%</b> מזמן הבנייה
        </span>
        {estimated && <Estimated>לפי סיום משוער</Estimated>}
      </div>
      <div
        className="pop-progress-bar"
        role="progressbar"
        aria-label="התקדמות הבנייה לפי הזמן"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ inlineSize: `${String(pct)}%` }} />
      </div>
    </div>
  );
}

/** The popup of a construction project: what is built, how far its works are, its phases and the city's details. */
export function ProjectPopup({
  project: p,
  fetchedAt,
  progress,
}: {
  project: Project;
  fetchedAt: string;
  /** Share of the works' time that has passed, for a building under construction at the time shown. */
  progress?: number | undefined;
}) {
  const facts = [
    p.stage && `שלב בנייה: ${p.stage}`,
    p.units !== undefined && `${String(p.units)} יח״ד`,
    p.tama38 && 'תמ״א 38',
    p.nightWorks && 'אושרו עבודות לילה',
    p.traffic,
  ].filter((x): x is string => typeof x === 'string' && x !== '');
  const color = p.kind === 'road' ? LAYER_COLOR.road : LAYER_COLOR.construction;
  const current = p.phases.at(-1)?.status;
  return (
    <PopupFrame
      className="project-pop"
      title={p.title}
      swatch={color}
      hollow={p.kind !== 'road' && current !== 'construction'}
      subtitle={p.address}
      source={
        <>
          מקור: {SOURCE[p.city] ?? p.city}. עודכן {formatDate(fetchedAt)}
        </>
      }
    >
      {progress !== undefined && <Progress value={progress} estimated={p.untilEstimated === true} />}
      <table>
        <tbody>
          {p.phases.map((ph, i) => {
            const end = p.phases[i + 1]?.since ?? p.until;
            const estimated = i === p.phases.length - 1 && p.untilEstimated === true;
            return (
              <tr key={ph.since}>
                <td dir="ltr" className="range">
                  {range(ph.since, end)}
                </td>
                <td>
                  <span className={`chip chip-${ph.status}`}>{STATUS_TEXT[ph.status]}</span>
                  {estimated && <Estimated>סיום משוער</Estimated>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {facts.length > 0 && (
        <ul className="pop-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {p.link && (
        <a className="pop-link" href={p.link} target="_blank" rel="noreferrer">
          התיק באתר העירייה
        </a>
      )}
    </PopupFrame>
  );
}
