import { useEffect, useRef } from 'react';
import { RAIL_INNER_M, RAIL_OUTER_M, SITE_HIGH_NOISE_M, SITE_LOW_NOISE_M } from '../domain/zones.ts';
import { formatDate } from './format.ts';

export const ISSUES_URL = 'https://github.com/ben-sembira-1/rails-plans-israel/issues/new';

/** What the map shows, how its dates and zones are made, its sources and how to report a mistake. */
export function AboutDialog({
  updated,
  constructionUpdated,
  onClose,
}: {
  /** When the rail data was last checked, `YYYY-MM-DD`. */
  updated: string;
  /** When the city construction snapshot was fetched (ISO), if loaded. */
  constructionUpdated: string | null;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (before instanceof HTMLElement) before.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div className="modal-head">
          <h2 id="about-title">אודות המפה</h2>
          <button ref={close} type="button" className="icon-btn" aria-label="סגירה" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>
            המפה מראה את אתרי העבודה בתל אביב–יפו: עבודות הרכבת של נת״ע ואתרי בנייה של בניינים, כדי שתוכלו
            לבחור בתבונה איפה לגור. אפשר לראות איפה עובדים היום, עד מתי, ומה צפוי ברחוב בשנים הבאות.
          </p>
          <p>
            בחרו זמן בציר הזמן, והמפה, מצב הקווים והאירועים מתעדכנים: מה פועל, מה נבנה ואיפה העבודות פוגעות
            ברחוב.
          </p>

          <h3>מאיפה המועדים</h3>
          <p>
            מועדי הפתיחה ושלבי העבודות לקוחים מלו״ז העבודות שפרסמה נת״ע ומהתוכניות הסטטוטוריות. עד שלוש שנים
            מהיום הציר מתקדם ברבעונים; אחרי זה בשנים, כי המועדים הרחוקים פחות ודאיים. מועדים שלא פורסמו
            מופיעים בסוף הציר תחת ״ללא מועד״.
          </p>

          <h3>אזורי העבודות</h3>
          <p>
            עבודות רכבת מסומנות בקנה מידה אמיתי: רצועה כהה עד {RAIL_INNER_M} מ׳ מהקו, שם הפגיעה החזקה ביותר,
            ורצועה בהירה עד {RAIL_OUTER_M} מ׳. כתום לעבודות כבדות, צהוב לעבודות קלות. אתר בנייה פעיל מסומן
            בחום: רעש חזק עד {SITE_HIGH_NOISE_M} מ׳ מהאתר ורעש חלש עד {SITE_LOW_NOISE_M} מ׳. הבניין עצמו מתמלא
            מלמטה למעלה לפי החלק של זמן הבנייה שעבר, מתחילת העבודות ועד הסיום שפורסם או שהוערך.
          </p>
          <p>
            כשמועד הסיום של בנייה לא פורסם, הוא מוערך: שלוש שנים לבניין חדש ושנתיים לתוספת בנייה. קווי המטרו
            משורטטים בקו ישר בין התחנות, ותחנות שמיקומן לא סופי מסומנות ״מיקום משוער״.
          </p>

          <h3>מקורות</h3>
          <ul>
            <li>
              <a href="https://www.gov.il/he/departments/iplan" target="_blank" rel="noreferrer">
                מינהל התכנון
              </a>
              : שכבות תמ״א 70 ו״חצב״.
            </li>
            <li>
              <a href="https://www.nta.co.il" target="_blank" rel="noreferrer">
                נת״ע
              </a>
              : לו״ז העבודות והפתיחות. נתוני הרכבות נכונים ל־{formatDate(updated)}.
            </li>
            <li>
              <a href="https://gisn.tel-aviv.gov.il" target="_blank" rel="noreferrer">
                עיריית תל אביב–יפו
              </a>
              : היתרי בנייה ועבודות כביש, מתעדכן מדי יום
              {constructionUpdated === null ? '.' : ` (עודכן ${formatDate(constructionUpdated)}).`}
            </li>
            <li>
              <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{' '}
              וויקיפדיה: מסילות רכבת ישראל ופרטי תחנות.
            </li>
          </ul>

          <h3>קיצורי מקלדת בציר הזמן</h3>
          <ul>
            <li>חצים: רבעון או שנה אחורה וקדימה.</li>
            <li>PageUp ו־PageDown: לאירוע הבא או הקודם.</li>
            <li>רווח: ניגון ועצירה.</li>
          </ul>

          <h3>מצאתם טעות?</h3>
          <p>
            <a href={ISSUES_URL} target="_blank" rel="noreferrer">
              דווחו עליה ב־GitHub
            </a>
            , עם הקטע או התחנה והמקור הנכון.
          </p>

          <p className="disclaimer">
            האתר אינו אתר רשמי של נת״ע, של משרד התחבורה או של העירייה. המידע נאסף ממקורות פומביים ועשוי
            להשתנות.
          </p>
        </div>
      </div>
    </div>
  );
}
