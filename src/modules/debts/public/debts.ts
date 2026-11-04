/** Intentional cross-feature contracts; injectable providers require DebtsModule imports. */
export { DebtsService } from '../services/debts.service';
export { QueryDebtsDto } from '../dto/query-debts.dto';
export { DEBT_LIST_QUERY } from '../queries/debts.list-query';
export { buildDebtQuery } from '../queries/debt-query';
export { getDebtAgingRanges, DEBT_AGING_VALUES } from '../rules/debt-aging.rules';
export { debtPaymentState } from '../rules/debt-payment.rules';
