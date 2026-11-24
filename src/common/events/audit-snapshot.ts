/** Keep scalar audit columns, serializing Date and Decimal values as JSON. */
export function scalarSnapshot(record: object | null | undefined): Record<string, unknown> | null {
  if (!record) return null;

  const entries = Object.entries(record).filter(([, value]) => {
    if (Array.isArray(value)) return false;
    if (value === null || typeof value !== 'object') return true;

    return value instanceof Date || typeof (value as { toJSON?: unknown }).toJSON === 'function';
  });

  return JSON.parse(JSON.stringify(Object.fromEntries(entries)));
}
