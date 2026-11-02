/** Normalize accepted optional text without converting arbitrary objects into stored strings. */
export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = value.trim();
  return text.length ? text : null;
}
