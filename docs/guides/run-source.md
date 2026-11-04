# Run Source

Use Node 24 (`nvm use` reads `.nvmrc`) and npm. CI, Vercel and Docker use the same major.

## First Setup

```bash
npm install
cp .env.example .env
npm run setup:dev
```

Before running `setup:dev`, update `.env` with a real PostgreSQL / Neon connection string.

`setup:dev` runs:

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

## Daily Development

```bash
npm run dev
```

This command runs `nest start --watch`. Run `npm run db:generate` first if Prisma models changed
without running a migration.

## Debug In VS Code

The repository includes `.vscode/launch.json` for debugging NestJS with TypeScript source maps and
watch mode.

1. Stop another API process that is using the configured `PORT`.
2. Add a breakpoint in a controller, service, interceptor, or other TypeScript file.
3. Open **Run and Debug** in VS Code.
4. Select **NestJS: Debug (one click)**.
5. Press `F5`, then send the request from Postman.

This profile starts the API and attaches VS Code automatically. Do not start `npm run dev` or
`npm run debug` separately when using it.

Alternatively, start the inspector manually:

```bash
npm run debug
```

Then select **NestJS: Attach to npm run debug** and press `F5`. The terminal should report both
`Debugger listening` and `Debugger attached` before you send a Postman request.

Useful debugger controls:

- `F10`: step over the current line.
- `F11`: step into the called function.
- `Shift+F11`: step out of the current function.
- `F5`: continue to the next breakpoint.

## Build

```bash
npm run build
```

This command runs:

```bash
npm run db:generate
nest build
node scripts/rewrite-build-aliases.mjs
```

The build generates the native ESM Prisma client and list-query schema metadata, then compiles Nest
and copies its Swagger browser asset, then rewrites short aliases in the compiled output. Generation does not connect to a database. List-query metadata
is generated from the same schema so startup validation does not depend on private Prisma internals.

`src/vercel.ts` compiles to `dist/src/vercel.js`. Vercel invokes the ESM entry `api/index.js`, which
exports that handler. The build rewrites `@auth/*`, `@common/*` and the other configured aliases to
relative ESM paths before deployment; plain Node needs no runtime alias resolver. See [Import Aliases](import-aliases.md).

## Run Compiled Output

```bash
npm run start
```

This runs:

```bash
node dist/src/main.js
```

## Environment

Create `.env`:

```bash
cp .env.example .env
```

Required values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB_NAME?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB_NAME?sslmode=require&channel_binding=require"
PORT=4000
JWT_SECRET="change-me-with-openssl-rand-base64-32"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:3000"
```

Do not commit real `.env` values.

## Troubleshooting

### `P1001: Can't reach database server`

Check `.env`:

```env
DATABASE_URL
DIRECT_URL
```

### Missing generated client or list-query metadata

Run:

```bash
npm run db:generate
```

### `EMFILE: too many open files, watch`

Close extra dev servers or increase the macOS file watcher limit. This project disables Nest asset watching in `nest-cli.json`:

```json
"watchAssets": false
```


## Deploy on Vercel or another Node platform

`package.json` pins Node `24.x`; keep the Vercel project's Node setting on 24 as well. `vercel.json`
runs `npm run build` and includes `dist/**` in the function. Use the Node runtime, not Edge.
Provide the deployment environment's `DATABASE_URL`, `JWT_SECRET` and other settings through the host.
The handler initializes Nest once per warm instance. The standalone server uses the host's `PORT`
and handles termination signals so Nest closes its Prisma pool.

For another Node host, run `npm ci`, `npm run build`, and `npm prune --omit=dev --ignore-scripts`.
Ship `package.json`, `dist/` and production `node_modules/` together; start with `npm start`.
Do not ship `.env`, source-only generated files or local caches. Run `npm run db:deploy` separately
from a release job with Prisma CLI and authorized database access when a release has migrations.
Neither the application startup nor the Docker image applies migrations or seeds data.

## Docker

```bash
docker build -t debtflow-api .
docker run --rm --init --env-file /path/to/deployment.env -p 4000:4000 debtflow-api
```

The multi-stage Dockerfile installs the locked dependencies, compiles ESM and runs Node 24 as the
non-root `node` user with production dependencies only. `.dockerignore` excludes real environment
files, generated source, local AI/editor data and build caches from the context. Environment values
are injected at runtime. The image build uses synthetic schema-generation URLs and performs no
schema writes or database connections. Open `/docs` to inspect the deployed API.
