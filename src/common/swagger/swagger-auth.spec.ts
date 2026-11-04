import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
        // Match Swagger 5.17: the root helper captures the action before custom wrappers.
        preauthorizeApiKey: (_name: string, value: string) =>
          authorizeOriginal({ bearer: { value } }),
        authSelectors: { authorized: () => ({ getIn: () => applied }) },
        authActions: { authorize, logout },
      };
    },
    { presets: { apis: {} } },
  );
  const listeners: Record<string, (event: Record<string, unknown>) => void> = {};
  const window = {
    addEventListener: (name: string, callback: (event: Record<string, unknown>) => void) => {
      listeners[name] = callback;
    },
    location: { href: 'http://localhost:4000/docs', origin: 'http://localhost:4000' },
    localStorage: {
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
  const script = readFileSync(join(import.meta.dirname, 'swagger-auth.js'), 'utf8');
  runInNewContext(script, {
    window,
    document: { getElementById: () => ({ dataset: { specUrl: '/docs-json' } }) },
    SwaggerUIBundle: bundle,
    SwaggerUIStandalonePreset: {},
    URL,
    atob,
    Date,
    setTimeout,
    clearTimeout,
  });
  window.onload();
  return {
    config: config!,
    window,
    storage,
    listeners,
    applied: () => applied,
    respond: (path = '/api/auth/login', token = 'login-token') =>
      config.responseInterceptor({
        url: `http://localhost:4000${path}`,
        status: 200,
        obj: { success: true, data: { accessToken: token, refreshToken: 'never-store-this' } },
      }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());

function jwt(secondsFromNow: number) {
  const claims = Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + secondsFromNow })).toString(
    'base64url',
  );
  return `fixture.${claims}.signature`;
}

describe('Swagger authorization', () => {
  it('applies tokens through Swagger authorization from login, refresh and organization switching', () => {
    const s = setup();
    for (const path of ['/api/auth/login', '/api/auth/refresh', '/api/auth/switch-organization']) {
      s.respond(path, path);
      expect(s.applied()).toBe(path);
      expect(s.storage.get(storageKey)).toBe(path);
    }
    expect([...s.storage.values()]).not.toContain('never-store-this');
  });

  it('uses the standard Authorize dialog and Logout for manual token replacement', () => {
    const s = setup();
    s.window.ui.authActions.authorize({ bearer: { value: 'Bearer dialog-token' } });
    expect(s.storage.get(storageKey)).toBe('dialog-token');
    expect(s.applied()).toBe('dialog-token');
    s.window.ui.authActions.logout(['bearer']);
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
    s.window.ui.authActions.authorize({ bearer: { value: 'replacement-token' } });
    expect(s.applied()).toBe('replacement-token');
    expect(s.storage.get(storageKey)).toBe('replacement-token');
  });

  it('restores the applied token after reloading and removes persistence on Logout', () => {
    const s = setup('saved-token');
    s.config.onComplete();
    expect(s.applied()).toBe('saved-token');
    s.window.ui.authActions.logout(['bearer']);
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
  });

  it('does not restore an expired JWT', () => {
    const claims = Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url');
    const s = setup(`header.${claims}.signature`);
    s.config.onComplete();
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
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

  it('reads JSON response text and still authorizes when browser storage is blocked', () => {
    const s = setup(undefined, true);
    expect(() => s.config.onComplete()).not.toThrow();
    s.config.responseInterceptor({
      url: '/api/auth/login',
      status: 200,
      text: JSON.stringify({ success: true, data: { accessToken: 'new-token' } }),
    });
    expect(s.applied()).toBe('new-token');
  });

  it('does not overwrite authorization with malformed tokens from auth responses', () => {
    const s = setup();
    s.respond();
    s.respond('/api/auth/login', 'invalid token');
    expect(s.applied()).toBe('login-token');
    expect(s.storage.get(storageKey)).toBe('login-token');
  });
  it('restores a login token across a new page instance even when preauthorization bypasses wrappers', () => {
    const token = jwt(3600);
    const first = setup();
    first.respond('/api/auth/login', token);
    expect(first.storage.get(storageKey)).toBe(token);
    const reloaded = setup(first.storage.get(storageKey));
    reloaded.config.onComplete();
    expect(reloaded.applied()).toBe(token);
    expect(reloaded.storage.get(storageKey)).toBe(token);
  });

  it('logs out and removes persistence at JWT expiry without a reload', () => {
    const s = setup();
    s.respond('/api/auth/login', jwt(60));
    vi.advanceTimersByTime(59_999);
    expect(s.applied()).not.toBe('');
    vi.advanceTimersByTime(1);
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
  });

  it('replaces the old expiry timer when refreshing or entering a new token', () => {
    const s = setup();
    s.respond('/api/auth/login', jwt(10));
    const replacement = jwt(120);
    s.window.ui.authActions.authorize({ bearer: { value: replacement } });
    vi.advanceTimersByTime(10_000);
    expect(s.applied()).toBe(replacement);
    vi.advanceTimersByTime(110_000);
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
  });

  it('does not overflow timers for tokens expiring more than 24.8 days later', () => {
    const s = setup();
    const token = jwt(40 * 86400);
    s.respond('/api/auth/login', token);
    vi.advanceTimersByTime(2147483647);
    expect(s.applied()).toBe(token);
    vi.advanceTimersByTime(40 * 86400 * 1000 - 2147483647);
    expect(s.applied()).toBe('');
  });

  it('synchronizes logout and token replacement from another tab', () => {
    const s = setup();
    s.respond('/api/auth/login', jwt(3600));
    s.listeners.storage({ storageArea: s.window.localStorage, key: storageKey, newValue: null });
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
    const token = jwt(7200);
    s.listeners.storage({ storageArea: s.window.localStorage, key: storageKey, newValue: token });
    expect(s.applied()).toBe(token);
    s.listeners.storage({ storageArea: s.window.localStorage, key: 'unrelated', newValue: null });
    expect(s.applied()).toBe(token);
  });

  it('rejects an expired manually entered JWT and clears persisted authorization', () => {
    const s = setup('older-token');
    s.config.onComplete();
    s.window.ui.authActions.authorize({ bearer: { value: jwt(-1) } });
    expect(s.applied()).toBe('');
    expect(s.storage.has(storageKey)).toBe(false);
  });
});
