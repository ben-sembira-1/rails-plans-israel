/** Loader and minimal types for Google Identity Services (https://accounts.google.com/gsi/client). */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface CredentialResponse {
  readonly credential: string;
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'small' | 'medium' | 'large';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      locale?: string;
    },
  ): void;
}

interface GoogleGlobal {
  readonly accounts: { readonly id: GoogleAccountsId };
}

function gisApi(): GoogleAccountsId | undefined {
  return (window as unknown as { google?: GoogleGlobal }).google?.accounts.id;
}

let loading: Promise<GoogleAccountsId> | null = null;

export function loadGis(): Promise<GoogleAccountsId> {
  const ready = gisApi();
  if (ready !== undefined) return Promise.resolve(ready);
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const api = gisApi();
      if (api === undefined) reject(new Error('Google sign-in did not load'));
      else resolve(api);
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load Google sign-in. Check the connection and reload.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
