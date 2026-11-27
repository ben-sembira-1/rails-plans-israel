import { render, screen, waitFor } from '@testing-library/react';
import { GoogleSignInButton } from './GoogleSignInButton.tsx';

describe('GoogleSignInButton', () => {
  afterEach(() => {
    delete (window as { google?: unknown }).google;
  });

  it('renders the Google button and passes the ID token on', async () => {
    let callback: ((r: { credential: string }) => void) | undefined;
    const initialize = vi.fn((c: { callback: (r: { credential: string }) => void }) => {
      callback = c.callback;
    });
    const renderButton = vi.fn((parent: HTMLElement) => {
      parent.append(Object.assign(document.createElement('button'), { textContent: 'Google' }));
    });
    (window as { google?: unknown }).google = { accounts: { id: { initialize, renderButton } } };

    const onCredential = vi.fn();
    render(<GoogleSignInButton clientId="client-1" onCredential={onCredential} onError={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Google' })).toBeInTheDocument();
    });
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-1', ux_mode: 'popup' }),
    );
    expect(screen.queryByText('טוען את כפתור ההתחברות…')).toBeNull();

    callback?.({ credential: 'id-token' });
    expect(onCredential).toHaveBeenCalledWith('id-token');
  });
});
