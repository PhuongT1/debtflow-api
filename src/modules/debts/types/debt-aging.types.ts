import type { DEBT_AGING_VALUES } from '../rules/debt-aging.rules.js';

export type DebtAging = (typeof DEBT_AGING_VALUES)[number];
