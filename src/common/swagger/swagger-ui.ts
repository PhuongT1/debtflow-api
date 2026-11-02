/** Browser-side Swagger helpers. Kept self-contained so the same script can be tested as served. */
const AUTH_SCRIPT = String.raw`
window.onload = () => {
  const storageKey = 'debtflow.swagger.access-token';
  const input = document.getElementById('swagger-access-token');
  const status = document.getElementById('swagger-token-status');
  const authPaths = new Set([
    '/api/auth/login', '/api/auth/refresh', '/api/auth/switch-organization'
  ]);
  const normalize = value => typeof value === 'string'
    ? value.trim().replace(/^Bearer\s+/i, '').trim() : '';
  const validToken = token => token.length > 0 && !/\s/.test(token);
  const save = token => {
    try {
      if (token) window.sessionStorage.setItem(storageKey, token);
      else window.sessionStorage.removeItem(storageKey);
    } catch {
      // Authorization still works when the browser disallows storage.
    }
  };
  const sync = token => {
    input.value = token;
    save(token);
    status.textContent = token ? 'Token applied.' : 'No token applied.';
  };
  const sessionAuthPlugin = () => ({
    statePlugins: {
      auth: {
        wrapActions: {
          authorize: original => payload => {
            if (payload.bearer) {
              const token = normalize(payload.bearer.value);
              payload = { ...payload, bearer: { ...payload.bearer, value: token } };
              sync(token);
            }
            return original(payload);
          },
          logout: original => names => {
            if (names.includes('bearer')) sync('');
            return original(names);
          }
        }
      }
    }
  });
  const apply = value => {
    const token = normalize(value);
    if (!token) {
      window.ui.authActions.logout(['bearer']);
    } else if (validToken(token)) {
      window.ui.preauthorizeApiKey('bearer', token);
    } else {
      status.textContent = 'Token must not contain spaces.';
    }
  };

  window.ui = SwaggerUIBundle({
    url: '/docs-json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: false,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [sessionAuthPlugin],
    layout: 'StandaloneLayout',
    responseInterceptor: response => {
      try {
        const url = new URL(response.url, window.location.href);
        if (url.origin !== window.location.origin || !authPaths.has(url.pathname) ||
            response.status < 200 || response.status >= 300) return response;
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
        const token = normalize(window.sessionStorage.getItem(storageKey));
        if (!validToken(token)) { save(''); return; }
        // Expiry is only a UI convenience; the API still verifies every token.
        const payload = token.split('.')[1];
        if (payload) {
          try {
            const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) {
              save('');
              status.textContent = 'Token expired. Log in or paste a new token.';
              return;
            }
          } catch { /* A manually supplied opaque token has no JWT expiry to inspect. */ }
        }
        apply(token);
      } catch { /* Storage may be unavailable in restricted browser sessions. */ }
    }
  });

  document.getElementById('swagger-token-form').addEventListener('submit', event => {
    event.preventDefault();
    apply(input.value);
  });
  document.getElementById('swagger-token-clear').addEventListener('click', () => apply(''));
  document.getElementById('swagger-token-show').addEventListener('change', event => {
    input.type = event.target.checked ? 'text' : 'password';
  });
  input.addEventListener('input', () => {
    status.textContent = 'Token edited. Click Apply to use it.';
  });
};
`;

export function renderSwaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Swagger UI - Sales Debt Management API</title>
    <link rel="icon" href="https://unpkg.com/swagger-ui-dist@5.17.14/favicon-32x32.png" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>
      .token-panel { max-width: 1460px; margin: 20px auto 0; padding: 16px 20px;
        box-sizing: border-box; font-family: sans-serif; color: #3b4151; }
      .token-panel label { font-weight: 600; }
      .token-controls { display: flex; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
      .token-controls input { flex: 1 1 240px; min-width: 0; padding: 9px;
        border: 1px solid #aaa; border-radius: 4px; font-family: monospace; }
      .token-controls button { padding: 8px 16px; cursor: pointer; border-radius: 4px;
        border: 1px solid #4990e2; color: #245d9e; background: white; font-weight: 600; }
      .token-panel p { margin: 8px 0; font-size: 13px; }
      .token-panel .token-show { font-weight: normal; font-size: 13px; }
    </style>
  </head>
  <body>
    <form id="swagger-token-form" class="token-panel" autocomplete="off">
      <label for="swagger-access-token">Access token</label>
      <div class="token-controls">
        <input id="swagger-access-token" type="password" autocomplete="off" spellcheck="false"
          aria-describedby="swagger-token-help swagger-token-status" placeholder="Paste an access token or log in below" />
        <button type="submit">Apply</button>
        <button id="swagger-token-clear" type="button">Clear</button>
      </div>
      <label class="token-show"><input id="swagger-token-show" type="checkbox" /> Show token</label>
      <p id="swagger-token-help">Login fills this field automatically. You can edit it or paste another token, then click Apply.</p>
      <p id="swagger-token-status" role="status" aria-live="polite">No token applied.</p>
    </form>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
    <script>${AUTH_SCRIPT}</script>
  </body>
</html>`;
}
