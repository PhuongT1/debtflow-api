/** Intentional cross-feature contracts; injectable providers require DebtsModule imports. */
export { DebtsService } from '../services/debts.service.js';
export { QueryDebtsDto } from '../dto/query-debts.dto.js';
export { DEBT_LIST_QUERY } from '../queries/debts.list-query.js';
export { buildDebtQuery } from '../queries/debt-query.js';
export { getDebtAgingRanges, DEBT_AGING_VALUES } from '../rules/debt-aging.rules.js';
export { debtPaymentState } from '../rules/debt-payment.rules.js';
