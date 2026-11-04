/** Public documentation routes shared by page rendering and server registration. */
export const SWAGGER_PATHS = {
  ui: '/docs',
  json: '/docs-json',
  authScript: '/docs/swagger-auth.js',
} as const;

// Keep the bundle, preset, styles and favicon on the same tested version.
const SWAGGER_UI_ASSETS = 'https://unpkg.com/swagger-ui-dist@5.17.14';

export function renderSwaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Swagger UI - Sales Debt Management API</title>
    <link rel="icon" href="${SWAGGER_UI_ASSETS}/favicon-32x32.png" />
    <link rel="stylesheet" href="${SWAGGER_UI_ASSETS}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui" data-spec-url="${SWAGGER_PATHS.json}"></div>
    <script src="${SWAGGER_UI_ASSETS}/swagger-ui-bundle.js"></script>
    <script src="${SWAGGER_UI_ASSETS}/swagger-ui-standalone-preset.js"></script>
    <script src="${SWAGGER_PATHS.authScript}"></script>
  </body>
</html>`;
}
