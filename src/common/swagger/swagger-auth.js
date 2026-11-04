/* Browser entry point served unchanged at /docs/swagger-auth.js. Tested as served. */
window.onload = () => {
  const storageKey = 'debtflow.swagger.access-token';
  const authPaths = new Set([
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/switch-organization',
  ]);
  const normalize = (value) =>
    typeof value === 'string'
      ? value
          .trim()
          .replace(/^Bearer\s+/i, '')
          .trim()
      : '';
  const validToken = (token) => token.length > 0 && !/\s/.test(token);
  // Swagger owns active authorization; this key only restores it after reload/reopening.
  let expiryTimer;
  const expiresAt = (token) => {
    try {
      const payload = token.split('.')[1];
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof claims.exp === 'number' && Number.isFinite(claims.exp)
        ? claims.exp * 1000
        : null;
    } catch {
      return null; // Manually supplied opaque tokens have no inspectable JWT expiry.
    }
  };
  const expired = (token) => {
    const expiry = expiresAt(token);
    return expiry !== null && expiry <= Date.now();
  };
  const remember = (token) => {
    clearTimeout(expiryTimer);
    try {
      if (token) window.localStorage.setItem(storageKey, token);
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Authorization still works when the browser disallows storage.
    }
    const expiry = token ? expiresAt(token) : null;
    if (expiry !== null) {
      const check = () => {
        const remaining = expiry - Date.now();
        if (remaining <= 0) window.ui.authActions.logout(['bearer']);
        else expiryTimer = setTimeout(check, Math.min(remaining, 2147483647));
      };
      // Check again after long timers instead of overflowing the browser timeout limit.
      expiryTimer = setTimeout(check, Math.min(Math.max(expiry - Date.now(), 0), 2147483647));
    }
  };
  const tokenPersistencePlugin = () => ({
    statePlugins: {
      auth: {
        wrapActions: {
          authorize: (original) => (payload) => {
            if (!payload.bearer) return original(payload);
            const token = normalize(payload.bearer.value);
            if (!validToken(token)) return;
            if (expired(token)) return window.ui.authActions.logout(['bearer']);
            const result = original({ ...payload, bearer: { ...payload.bearer, value: token } });
            remember(token);
            return result;
          },
          logout: (original) => (names) => {
            if (names.includes('bearer')) remember('');
            return original(names);
          },
        },
      },
    },
  });
  const apply = (token) => {
    if (!validToken(token) || expired(token)) {
      window.ui.authActions.logout(['bearer']);
      return;
    }
    window.ui.preauthorizeApiKey('bearer', token);
    // Swagger 5.17's root helper captures an earlier authorize action before custom wrappers.
    // Persist explicitly here as well as in the manual Authorize action.
    remember(token);
  };

  window.ui = SwaggerUIBundle({
    url: document.getElementById('swagger-ui').dataset.specUrl,
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: false,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [tokenPersistencePlugin],
    layout: 'StandaloneLayout',
    responseInterceptor: (response) => {
      try {
        const url = new URL(response.url, window.location.href);
        if (
          url.origin !== window.location.origin ||
          !authPaths.has(url.pathname) ||
          response.status < 200 ||
          response.status >= 300
        )
          return response;
        const raw = response.obj || response.data || response.text;
        const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const token = normalize(body && body.data && body.data.accessToken);
        if (body && body.success === true && validToken(token)) apply(token);
      } catch {
        // Non-JSON responses must remain visible in Swagger without breaking the UI.
      }
      return response;
    },
    onComplete: () => {
      try {
        const token = normalize(window.localStorage.getItem(storageKey));
        if (token) apply(token);
      } catch {
        /* Storage may be unavailable in restricted browser sessions. */
      }
    },
  });
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage) return;
    if (event.key === storageKey) apply(normalize(event.newValue));
    else if (event.key === null) window.ui.authActions.logout(['bearer']);
  });
  window.addEventListener('focus', () => {
    // Background tabs may throttle expiry timers.
    const token = window.ui.authSelectors.authorized().getIn(['bearer', 'value']);
    if (typeof token === 'string' && expired(token)) window.ui.authActions.logout(['bearer']);
  });
};
