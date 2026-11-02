/** Normalizes Vietnamese text for accent-insensitive search. */
export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi-VN')
    .trim();
}

export function partySearchText(...values: Array<string | null | undefined>) {
  return normalizeSearchText(values.filter(Boolean).join(' '));
}
