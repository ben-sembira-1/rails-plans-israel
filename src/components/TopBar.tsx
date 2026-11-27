import { formatTime } from '../domain/time.ts';
import { Logo } from './Logo.tsx';

export const APP_NAME = 'מפת הרכבות של גוש דן';

export interface TopBarProps {
  /** The time currently shown on the timeline. */
  readonly time: number;
  /** Account and admin controls (signed-in builds only). */
  readonly actions?: React.ReactNode;
  /** Opens the "about" dialog. */
  readonly onAbout?: () => void;
  /** Copies a link to the time shown. */
  readonly onShare?: () => void;
}

export function TopBar({ time, actions, onAbout, onShare }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-sub">רכבת קלה, מטרו ורכבת ישראל, עם ציר זמן של עבודות ופתיחות</span>
        </div>
        <span className="version-chip" dir="ltr">
          v{__APP_VERSION__}
        </span>
      </div>
      <div className="topbar-end">
        <div className="time-pill" aria-label="הזמן המוצג">
          <span className="time-pill-label">מוצג</span>
          <b dir="ltr" aria-live="polite">
            {formatTime(time)}
          </b>
        </div>
        {onShare && (
          <button type="button" className="topbar-btn" onClick={onShare} aria-label="העתקת קישור לזמן המוצג">
            <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5" />
              <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" />
            </svg>
            <span className="topbar-btn-text">העתקת קישור</span>
          </button>
        )}
        {onAbout && (
          <button type="button" className="topbar-btn" onClick={onAbout} aria-label="אודות המפה">
            <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 9v5M10 6.2v.1" />
            </svg>
            <span className="topbar-btn-text">אודות</span>
          </button>
        )}
        {actions}
      </div>
    </header>
  );
}
