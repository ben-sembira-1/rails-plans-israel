import { useState } from 'react';
import type { FirebaseServices } from './firebase.ts';
import type { AllUsers } from './useAllUsers.ts';
import { deleteUser, setApproved, type UserProfile } from './users.ts';

export interface AdminViewProps {
  readonly users: readonly UserProfile[];
  readonly selfUid: string;
  readonly error: string | null;
  readonly onApprove: (uid: string) => void;
  readonly onRevoke: (uid: string) => void;
  readonly onReject: (uid: string) => void;
  readonly onBack: () => void;
}

const dateFormat = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' });

function Person({ user }: { user: UserProfile }) {
  const initial = (user.displayName || user.email).trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="person">
      <span className="avatar" aria-hidden="true">
        {initial}
      </span>
      <div className="person-text">
        <b dir="auto">{user.displayName || user.email}</b>
        <span dir="ltr">{user.email}</span>
        {user.requestedAt !== null && (
          <span className="muted">נרשם/ה: {dateFormat.format(user.requestedAt)}</span>
        )}
      </div>
    </div>
  );
}

/** The admin center page: access requests and approved users. */
export function AdminView({ users, selfUid, error, onApprove, onRevoke, onReject, onBack }: AdminViewProps) {
  const pending = users.filter((u) => !u.approved);
  const approved = users.filter((u) => u.approved && u.uid !== selfUid);
  return (
    <main className="admin-center">
      <div className="admin-inner">
        <div className="admin-title">
          <h1>מרכז ניהול</h1>
          <button type="button" className="btn" onClick={onBack}>
            חזרה למפה
          </button>
        </div>
        {error !== null && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        <section className="admin-card" aria-labelledby="pending-title">
          <h2 id="pending-title">
            ממתינים לאישור <span className="count">{pending.length}</span>
          </h2>
          {pending.length === 0 ? (
            <p className="muted">אין בקשות חדשות.</p>
          ) : (
            <ul aria-label="ממתינים לאישור">
              {pending.map((u) => (
                <li key={u.uid}>
                  <Person user={u} />
                  <span className="actions">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        onApprove(u.uid);
                      }}
                    >
                      אישור
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        onReject(u.uid);
                      }}
                    >
                      דחייה
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card" aria-labelledby="approved-title">
          <h2 id="approved-title">
            משתמשים מאושרים <span className="count">{approved.length}</span>
          </h2>
          {approved.length === 0 ? (
            <p className="muted">עדיין אין משתמשים מאושרים מלבדך.</p>
          ) : (
            <ul aria-label="משתמשים מאושרים">
              {approved.map((u) => (
                <li key={u.uid}>
                  <Person user={u} />
                  <span className="actions">
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => {
                        onRevoke(u.uid);
                      }}
                    >
                      ביטול גישה
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export function AdminCenter({
  fb,
  selfUid,
  all,
  onBack,
}: {
  fb: FirebaseServices;
  selfUid: string;
  all: AllUsers;
  onBack: () => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const run = (p: Promise<void>) => {
    setActionError(null);
    p.catch((e: unknown) => {
      setActionError(e instanceof Error ? e.message : String(e));
    });
  };
  return (
    <AdminView
      users={all.users}
      selfUid={selfUid}
      error={actionError ?? all.error}
      onApprove={(uid) => {
        run(setApproved(fb, uid, true));
      }}
      onRevoke={(uid) => {
        run(setApproved(fb, uid, false));
      }}
      onReject={(uid) => {
        run(deleteUser(fb, uid));
      }}
      onBack={onBack}
    />
  );
}
