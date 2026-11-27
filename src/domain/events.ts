import type { Section, Site } from '../data/schema.ts';
import { NO_DATE, snap, TODAY } from './time.ts';

export interface Milestone {
  readonly time: number;
  /** Short button label. */
  readonly label: string;
  readonly caption: string;
  readonly description: string;
}

/** The macro timeline: main opening events. */
export const MILESTONES: readonly Milestone[] = [
  {
    time: 2023.5,
    label: 'אוג׳ 2023',
    caption: 'אוגוסט 2023 · הקו האדום',
    description:
      'פתח תקווה – בני ברק – רמת גן – תל אביב – בת ים, 34 תחנות. זה מה שפועל היום (נובמבר 2026), לצד רכבת ישראל.',
  },
  {
    time: 2028.25,
    label: 'אמצע 2028',
    caption: 'יוני–יולי 2028 · הקו הסגול',
    description:
      'כל הקו בבת אחת: מסוף ארלוזורוב – אלנבי – ההגנה – אלוף שדה – שיבא, עם שלוחה לבר־אילן ולכפר גנים ושלוחה ליהוד.',
  },
  {
    time: 2028.75,
    label: 'סוף 2028',
    caption: 'סוף 2028 · הקו הירוק, מקטע דרומי',
    description: 'ראשון לציון וחולון עד גינת לוינסקי בתל אביב (מעבר לקו הסגול).',
  },
  {
    time: 2030,
    label: '2030',
    caption: '2030 · הקו הירוק, מקטע צפוני',
    description: 'מלוינסקי מתחת לאבן גבירול לצפון העיר, ומשם שלוחה להרצליה ושלוחה לרמת החייל.',
  },
  {
    time: 2037,
    label: '2034–37',
    caption: '2034–2037 · מטרו, שלב א׳',
    description:
      'M1 מגלילות לראשונים, M2 כולו (וולפסון – סגולה), M3 מהקוממיות בבת ים לקריית אריה. היעד הרשמי הוא פתיחה בשלבים בין 2034 ל־2037; הערכות בתקשורת מדברות על 2037–2042.',
  },
  {
    time: NO_DATE,
    label: 'ללא מועד',
    caption: 'ללא מועד מוכרז · שלב ב׳ – הרשת המלאה',
    description:
      'המשך M1 לרעננה, לכפר סבא, לרחובות וללוד–רמלה; המשך M3 להרצליה ושלוחה לנתב״ג; הארכת הקו האדום לראשון לציון.',
  },
];

const EVENT_LABELS: ReadonlyMap<number, string> = new Map([
  [2023.5, 'הקו האדום נפתח'],
  [2024.5, 'אלנבי נסגר לרכב'],
  [2025.75, 'מטרו: אתרי הכנה ראשונים'],
  [2026.5, 'פיר שילוח M2, כפר גנים'],
  [TODAY, 'היום · אתר הבימה M2'],
  [2028.25, 'הסגול נפתח'],
  [2028.75, 'הירוק דרום נפתח'],
  [2029, 'מטרו: עבודות כבדות'],
  [2030, 'הירוק צפון נפתח'],
  [2034, 'מטרו: מסילות ומערכות'],
  [2037, 'מטרו שלב א׳ נפתח'],
  [NO_DATE, 'שלב ב׳ והארכת האדום'],
]);

export function eventLabel(t: number): string | undefined {
  return EVENT_LABELS.get(t);
}

/**
 * Every time at which a section's or a site's works status changes, plus today.
 * Times are snapped to the timeline grid, so events from 2030 fall on full years.
 */
export function worksEvents(sections: readonly Section[], sites: readonly Site[]): readonly number[] {
  const times = [
    TODAY,
    ...sites.map((s) => s.since),
    ...sections.flatMap((s) => s.phases.flatMap((p) => (p.since === null ? [] : [p.since]))),
  ].map(snap);
  return [...new Set(times)].sort((a, b) => a - b);
}

export function milestoneAt(t: number): Milestone | undefined {
  return MILESTONES.find((m) => m.time === t);
}
