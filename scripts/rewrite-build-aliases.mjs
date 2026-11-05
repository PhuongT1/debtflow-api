import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceTscAliasPaths } from 'tsc-alias';

// Nest passes its compiled entrypoint to Node. Dev and production output are deliberately isolated.
const root = fileURLToPath(new URL('../', import.meta.url));
const entry = process.argv[1] ? relative(root, resolve(process.argv[1])) : '';
const config = entry.split(sep)[0] === 'dist-dev' ? 'tsconfig.dev.json' : 'tsconfig.build.json';

// Used after production compilation and as Nest's pre-start hook on every watch rebuild.
await replaceTscAliasPaths({
  configFile: fileURLToPath(new URL(`../${config}`, import.meta.url)),
  resolveFullPaths: true,
  resolveFullExtension: '.js',
});
