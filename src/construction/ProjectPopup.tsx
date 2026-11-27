import type { Project } from '../data/construction.ts';
import { formatTime, stepBefore } from '../domain/time.ts';
import { STATUS_TEXT } from './style.ts';

const SOURCE: Readonly<Record<string, string>> = { 'tel-aviv': 'עיריית תל אביב–יפו' };

function updated(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear())}`;
}

/** "2025Q2–2026Q3": from a phase's start to the step before the next one (or before the end of works). */
function range(from: number, to: number | null): string {
  if (to === null) return `${formatTime(from)}–`;
  const last = stepBefore(to);
  return last <= from ? formatTime(from) : `${formatTime(from)}–${formatTime(last)}`;
}

/** The popup of a construction project: what is built, its phases and the city's details. */
export function ProjectPopup({ project: p, fetchedAt }: { project: Project; fetchedAt: string }) {
  const facts = [
    p.stage && `שלב בנייה: ${p.stage}`,
    p.units !== undefined && `${String(p.units)} יח״ד`,
    p.tama38 && 'תמ״א 38',
    p.nightWorks && 'אושרו עבודות לילה',
    p.traffic,
  ].filter((x): x is string => typeof x === 'string' && x !== '');
  return (
    <div className="pop project-pop">
      <b>{p.title}</b>
      <div>{p.address}</div>
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
                  {estimated && ' (סיום משוער)'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {facts.length > 0 && <div>{facts.join(' · ')}</div>}
      {p.link && (
        <div>
          <a href={p.link} target="_blank" rel="noreferrer">
            התיק באתר העירייה
          </a>
        </div>
      )}
      <div className="pop-source">
        מקור: {SOURCE[p.city] ?? p.city} · עודכן {updated(fetchedAt)}
      </div>
    </div>
  );
}
