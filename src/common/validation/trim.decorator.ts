import { Transform } from 'class-transformer';

/** Trims string input before validation; other types pass through. Empty strings stay empty. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
