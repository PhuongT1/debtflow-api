/** Plain nonnegative decimal text accepted by PostgreSQL NUMERIC(18, 2) without rounding. */
export const MONEY_SCALE = 2;
export const MONEY_AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;
