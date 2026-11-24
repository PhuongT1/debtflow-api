// Keep adopted features enrolled even if a refactor accidentally moves every layer file.
const cleanFeatures = new Set([
  'audit-logs',
  'auth',
  'catalog',
  'dashboard',
  'debts',
  'payments',
  'exports',
  'imports',
  'parties',
  'reports',
  'users',
]);

export function cleanFeatureRoot(path) {
  const [, feature] = /^src\/modules\/([^/]+)\//.exec(path) ?? [];
  return cleanFeatures.has(feature) ? `src/modules/${feature}` : undefined;
}
