import type { DEBT_AGING_VALUES } from '../rules/debt-aging.rules';

export type DebtAging = (typeof DEBT_AGING_VALUES)[number];
