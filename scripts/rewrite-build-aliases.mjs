import { fileURLToPath } from 'node:url';
import { replaceTscAliasPaths } from 'tsc-alias';

// Used after production compilation and as Nest's pre-start hook on every watch rebuild.
await replaceTscAliasPaths({
  configFile: fileURLToPath(new URL('../tsconfig.build.json', import.meta.url)),
  resolveFullPaths: true,
  resolveFullExtension: '.js',
});
