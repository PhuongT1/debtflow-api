# Run Source

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
tsc-alias -p tsconfig.json
```

`src/vercel.ts` contains the NestJS serverless bootstrap. The build compiles it to
`dist/src/vercel.js` and rewrites TypeScript path aliases. Vercel invokes `api/index.js`, which
loads that compiled handler. This is required because Vercel Functions do not resolve TypeScript
`paths` mappings in raw function source.

`tsc-alias` rewrites TypeScript path aliases in `dist` so compiled Node.js output can run.

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

### `Cannot find module '@generated/prisma'`

Run:

```bash
npm run db:generate
```

### `EMFILE: too many open files, watch`

Close extra dev servers or increase the macOS file watcher limit. This project disables Nest asset watching in `nest-cli.json`:

```json
"watchAssets": false
```
