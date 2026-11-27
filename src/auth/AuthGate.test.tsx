import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import { AdminView } from './AdminPanel.tsx';
import { AccessScreen } from './AuthGate.tsx';
import { firebaseConfig, googleClientId } from './firebase.ts';
import type { UserProfile } from './users.ts';

const user = { uid: 'u1', email: 'someone@example.com' } as User;

describe('AccessScreen', () => {
  it('asks signed-out visitors to sign in with Google', async () => {
    const onSignIn = vi.fn();
    render(
      <AccessScreen
        access={{ kind: 'signedOut' }}
        signIn={
          <button type="button" onClick={onSignIn}>
            התחברות עם Google
          </button>
        }
        onSignOut={vi.fn()}
        signInError={null}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'התחברות עם Google' }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('map')).toBeNull();
  });

  it('tells pending users their request is waiting for the admin', () => {
    render(
      <AccessScreen
        access={{ kind: 'pending', user }}
        signIn={null}
        onSignOut={vi.fn()}
        signInError={null}
      />,
    );
    expect(screen.getByRole('heading', { name: 'הבקשה נשלחה' })).toBeInTheDocument();
    expect(screen.getByText(/someone@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התנתקות' })).toBeInTheDocument();
  });

  it('shows sign-in errors', () => {
    render(
      <AccessScreen
        access={{ kind: 'signedOut' }}
        signIn={null}
        onSignOut={vi.fn()}
        signInError="popup closed"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('popup closed');
  });
});

const profile = (uid: string, approved: boolean): UserProfile => ({
  uid,
  email: `${uid}@example.com`,
  displayName: uid,
  approved,
  requestedAt: null,
  timelinePosition: null,
});

describe('AdminView', () => {
  it('lists pending requests and approves them', async () => {
    const onApprove = vi.fn();
    render(
      <AdminView
        users={[profile('admin', true), profile('new', false), profile('old', true)]}
        selfUid="admin"
        error={null}
        onApprove={onApprove}
        onRevoke={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('1 ממתינים')).toBeInTheDocument();
    const pending = screen.getByRole('list', { name: 'ממתינים לאישור' });
    expect(pending).toHaveTextContent('new@example.com');
    const approved = screen.getByRole('list', { name: 'משתמשים מאושרים' });
    expect(approved).toHaveTextContent('old@example.com');
    expect(approved).not.toHaveTextContent('admin@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'אישור' }));
    expect(onApprove).toHaveBeenCalledWith('new');
  });
});

describe('firebaseConfig', () => {
  it('needs all four values', () => {
    expect(firebaseConfig({})).toBeNull();
    expect(
      firebaseConfig({
        VITE_FIREBASE_API_KEY: 'k',
        VITE_FIREBASE_AUTH_DOMAIN: 'd',
        VITE_FIREBASE_PROJECT_ID: 'p',
        VITE_FIREBASE_APP_ID: 'a',
      }),
    ).toEqual({ apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' });
  });
});

describe('googleClientId', () => {
  it('is null when unset or blank, so sign-in falls back to the Firebase popup', () => {
    expect(googleClientId({})).toBeNull();
    expect(googleClientId({ VITE_GOOGLE_CLIENT_ID: '  ' })).toBeNull();
    expect(googleClientId({ VITE_GOOGLE_CLIENT_ID: 'abc.apps.googleusercontent.com' })).toBe(
      'abc.apps.googleusercontent.com',
    );
  });
});
