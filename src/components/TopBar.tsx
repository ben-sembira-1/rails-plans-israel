import { formatTime } from '../domain/time.ts';
import { Logo } from './Logo.tsx';

export const APP_NAME = 'מפת הרכבות של גוש דן';

export interface TopBarProps {
  /** The time currently shown on the timeline. */
  readonly time: number;
  /** Account and admin controls (signed-in builds only). */
  readonly actions?: React.ReactNode;
}

export function TopBar({ time, actions }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-sub">רכבת קלה · מטרו · רכבת ישראל</span>
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
        {actions}
      </div>
    </header>
  );
}
