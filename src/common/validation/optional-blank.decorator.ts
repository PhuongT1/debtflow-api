import { ValidateIf } from 'class-validator';

/**
 * Skips every validator of the property when the value is undefined, null or an empty string.
 * Used on optional text fields where sending a blank value means "clear it".
 */
export const OptionalBlank = () =>
  ValidateIf((_object, value) => value !== undefined && value !== null && value !== '');
