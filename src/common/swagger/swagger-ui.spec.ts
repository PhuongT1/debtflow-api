import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { renderSwaggerHtml } from './swagger-ui';

type Response = { url: string; status: number; obj?: unknown; data?: unknown; text?: string };
type AuthPayload = Record<string, { value: string }>;
type WrapActions = {
  authorize: (original: (payload: AuthPayload) => void) => (payload: AuthPayload) => void;
  logout: (original: (names: string[]) => void) => (names: string[]) => void;
};
type Config = {
  responseInterceptor: (response: Response) => Response;
  onComplete: () => void;
  plugins: Array<() => { statePlugins: { auth: { wrapActions: WrapActions } } }>;
};

const storageKey = 'debtflow.swagger.access-token';

function setup(savedToken?: string, blockedStorage = false) {
  const storage = new Map(savedToken ? [[storageKey, savedToken]] : []);
  const elements = new Map<
    string,
    {
      value: string;
      textContent: string;
      type: string;
      listeners: Record<string, (event: unknown) => void>;
      addEventListener: (name: string, listener: (event: unknown) => void) => void;
    }
  >();
  const document = {
    getElementById: (id: string) => {
      if (!elements.has(id)) {
        const listeners = {};
        elements.set(id, {
          value: '',
          textContent: '',
          type: 'password',
          listeners,
          addEventListener: (name, listener) => {
            elements.get(id)!.listeners[name] = listener;
          },
        });
      }
      return elements.get(id)!;
    },
  };
  let config: Config;
  let applied = '';
  const authorizeOriginal = vi.fn((payload: AuthPayload) => {
    applied = payload.bearer.value;
  });
  const logoutOriginal = vi.fn(() => {
    applied = '';
  });
  const bundle = Object.assign(
    (options: Config) => {
      config = options;
      const wrappers = options.plugins[0]().statePlugins.auth.wrapActions;
      const authorize = wrappers.authorize(authorizeOriginal);
      const logout = wrappers.logout(logoutOriginal);
      return {
        preauthorizeApiKey: (_name: string, value: string) => authorize({ bearer: { value } }),
        authActions: { authorize, logout },
      };
    },
    { presets: { apis: {} } },
  );
  const window = {
    location: { href: 'http://localhost:4000/docs', origin: 'http://localhost:4000' },
    sessionStorage: {
      getItem: (key: string) => {
        if (blockedStorage) throw Error('blocked');
        return storage.get(key);
      },
      setItem: (key: string, value: string) => {
        if (blockedStorage) throw Error('blocked');
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        if (blockedStorage) throw Error('blocked');
        storage.delete(key);
      },
    },
    onload: () => {},
    ui: undefined as unknown as ReturnType<typeof bundle>,
  };
  const script = renderSwaggerHtml().match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, {
    window,
    document,
    SwaggerUIBundle: bundle,
    SwaggerUIStandalonePreset: {},
    URL,
    atob,
  });
  window.onload();
  return {
    config: config!,
    window,
    storage,
    document,
    input: document.getElementById('swagger-access-token'),
    status: document.getElementById('swagger-token-status'),
    applied: () => applied,
    respond: (path = '/api/auth/login', token = 'login-token') =>
      config.responseInterceptor({
        url: `http://localhost:4000${path}`,
        status: 200,
        obj: { success: true, data: { accessToken: token, refreshToken: 'never-store-this' } },
      }),
    submit: () =>
      document.getElementById('swagger-token-form').listeners.submit({ preventDefault: () => {} }),
  };
}

describe('Swagger token field and authorization', () => {
  it('fills the editable input and applies tokens from login, refresh and organization switching', () => {
    const s = setup();
    for (const path of ['/api/auth/login', '/api/auth/refresh', '/api/auth/switch-organization']) {
      s.respond(path, path);
      expect(s.input.value).toBe(path);
      expect(s.applied()).toBe(path);
      expect(s.storage.get(storageKey)).toBe(path);
    }
    expect([...s.storage.values()]).not.toContain('never-store-this');
  });

  it('lets users edit or replace the auto-filled token and apply it explicitly', () => {
    const s = setup();
    s.respond();
    s.input.value = ' Bearer edited-token ';
    s.input.listeners.input({});
    expect(s.applied()).toBe('login-token');
    s.submit();
    expect(s.input.value).toBe('edited-token');
    expect(s.applied()).toBe('edited-token');
    expect(s.storage.get(storageKey)).toBe('edited-token');
  });

  it('synchronizes the standard Authorize dialog and Logout', () => {
    const s = setup();
    s.window.ui.authActions.authorize({ bearer: { value: 'Bearer dialog-token' } });
    expect(s.input.value).toBe('dialog-token');
    expect(s.applied()).toBe('dialog-token');
    s.window.ui.authActions.logout(['bearer']);
    expect(s.input.value).toBe('');
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
  });

  it('restores the applied token after reloading and clears it with Clear', () => {
    const s = setup('saved-token');
    s.config.onComplete();
    expect(s.input.value).toBe('saved-token');
    expect(s.applied()).toBe('saved-token');
    s.document.getElementById('swagger-token-clear').listeners.click({});
    expect(s.applied()).toBe('');
    expect(s.input.value).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
  });

  it('does not restore an expired JWT', () => {
    const claims = Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url');
    const s = setup(`header.${claims}.signature`);
    s.config.onComplete();
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
    expect(s.status.textContent).toContain('expired');
  });

  it('does not replace authorization on failed, unrelated, foreign or malformed responses', () => {
    const s = setup();
    s.respond();
    const obj = { success: true, data: { accessToken: 'wrong-token' } };
    for (const response of [
      { url: '/api/auth/login', status: 401, obj },
      { url: '/api/auth/login', status: 200, obj: { ...obj, success: false } },
      { url: '/api/parties', status: 200, obj },
      { url: 'https://other.example/api/auth/login', status: 200, obj },
      { url: '/api/auth/login', status: 200, text: 'not json' },
      { url: '/api/auth/login', status: 200, obj: { success: true, data: {} } },
    ]) {
      expect(s.config.responseInterceptor(response)).toBe(response);
      expect(s.applied()).toBe('login-token');
    }
  });

  it('reads JSON response text and still authorizes when session storage is blocked', () => {
    const s = setup(undefined, true);
    expect(() => s.config.onComplete()).not.toThrow();
    s.config.responseInterceptor({
      url: '/api/auth/login',
      status: 200,
      text: JSON.stringify({ success: true, data: { accessToken: 'new-token' } }),
    });
    expect(s.input.value).toBe('new-token');
    expect(s.applied()).toBe('new-token');
  });

  it('rejects tokens containing whitespace without changing existing authorization', () => {
    const s = setup();
    s.respond();
    s.input.value = 'invalid token';
    s.submit();
    expect(s.applied()).toBe('login-token');
    expect(s.status.textContent).toContain('spaces');
  });

  it('lets users reveal and hide the editable token', () => {
    const s = setup();
    const checkbox = s.document.getElementById('swagger-token-show');
    checkbox.listeners.change({ target: { checked: true } });
    expect(s.input.type).toBe('text');
    checkbox.listeners.change({ target: { checked: false } });
    expect(s.input.type).toBe('password');
  });
});
