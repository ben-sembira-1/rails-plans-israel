export interface HeaderActionsProps {
  readonly email: string;
  readonly isAdmin: boolean;
  readonly adminOpen: boolean;
  readonly pendingCount: number;
  readonly onAdmin: () => void;
  readonly onSignOut: () => void;
}

/** Top-strip controls for signed-in users: the admin center button (admins only) and the account menu. */
export function HeaderActions({
  email,
  isAdmin,
  adminOpen,
  pendingCount,
  onAdmin,
  onSignOut,
}: HeaderActionsProps) {
  return (
    <>
      {isAdmin && (
        <button
          type="button"
          className={adminOpen ? 'topbar-btn active' : 'topbar-btn'}
          aria-pressed={adminOpen}
          onClick={onAdmin}
        >
          <span className="topbar-btn-icon" aria-hidden="true">
            ⚙
          </span>
          <span className="topbar-btn-text">מרכז ניהול</span>
          {pendingCount > 0 && (
            <span className="badge" aria-label={`${pendingCount} ממתינים לאישור`}>
              {pendingCount}
            </span>
          )}
        </button>
      )}
      <details className="user-menu">
        <summary aria-label="חשבון">
          <span className="avatar">{email.charAt(0).toUpperCase() || '?'}</span>
        </summary>
        <div className="menu" role="menu">
          <div className="menu-email" dir="ltr">
            {email}
          </div>
          <button type="button" role="menuitem" className="btn" onClick={onSignOut}>
            התנתקות
          </button>
        </div>
      </details>
    </>
  );
}
