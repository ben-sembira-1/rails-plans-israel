import { useEffect, useState } from 'react';
import type { FirebaseServices } from './firebase.ts';
import { deleteUser, setApproved, watchAllUsers, type UserProfile } from './users.ts';

export interface AdminViewProps {
  readonly users: readonly UserProfile[];
  readonly selfUid: string;
  readonly error: string | null;
  readonly onApprove: (uid: string) => void;
  readonly onRevoke: (uid: string) => void;
  readonly onReject: (uid: string) => void;
}

function who(u: UserProfile): string {
  return u.displayName ? `${u.displayName} (${u.email})` : u.email;
}

export function AdminView({ users, selfUid, error, onApprove, onRevoke, onReject }: AdminViewProps) {
  const pending = users.filter((u) => !u.approved);
  const approved = users.filter((u) => u.approved && u.uid !== selfUid);
  return (
    <details className="admin" open={pending.length > 0}>
      <summary>
        ניהול גישה {pending.length > 0 && <span className="badge">{pending.length} ממתינים</span>}
      </summary>
      {error !== null && <div role="alert">{error}</div>}
      <div>ממתינים לאישור</div>
      {pending.length === 0 ? (
        <div className="muted">אין בקשות חדשות</div>
      ) : (
        <ul aria-label="ממתינים לאישור">
          {pending.map((u) => (
            <li key={u.uid}>
              <span dir="auto">{who(u)}</span>
              <span>
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => {
                    onApprove(u.uid);
                  }}
                >
                  אישור
                </button>{' '}
                <button
                  type="button"
                  className="btn small"
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
      <div>משתמשים מאושרים</div>
      <ul aria-label="משתמשים מאושרים">
        {approved.map((u) => (
          <li key={u.uid}>
            <span dir="auto">{who(u)}</span>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                onRevoke(u.uid);
              }}
            >
              ביטול גישה
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AdminPanel({ fb, selfUid }: { fb: FirebaseServices; selfUid: string }) {
  const [users, setUsers] = useState<readonly UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () =>
      watchAllUsers(fb, setUsers, (e) => {
        setError(e.message);
      }),
    [fb],
  );
  const run = (p: Promise<void>) => {
    p.catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  };
  return (
    <AdminView
      users={users}
      selfUid={selfUid}
      error={error}
      onApprove={(uid) => {
        run(setApproved(fb, uid, true));
      }}
      onRevoke={(uid) => {
        run(setApproved(fb, uid, false));
      }}
      onReject={(uid) => {
        run(deleteUser(fb, uid));
      }}
    />
  );
}
