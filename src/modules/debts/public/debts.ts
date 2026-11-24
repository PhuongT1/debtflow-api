/** Intentional cross-feature contracts; injectable providers require DebtsModule imports. */
export { DebtsService } from '../application/debts.service.js';
export { QueryDebtsDto } from '../presentation/dto/query-debts.dto.js';
export { DEBT_LIST_QUERY } from '../debts.list-query.js';
export { getDebtAgingRanges } from '../domain/debt-aging.rules.js';
export { DEBT_AGING_VALUES } from './debt-filters.types.js';
