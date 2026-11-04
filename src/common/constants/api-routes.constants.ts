/** Path segments shared by Nest registration. Full method + URL catalog is generated from OpenAPI. */
export const API_PREFIX = 'api';
const RESOURCE_ID_PATH = ':id';

export const API_ROUTES = {
  AUTH: {
    PREFIX: 'auth',
    LOGIN: 'login',
    REFRESH: 'refresh',
    SWITCH_ORGANIZATION: 'switch-organization',
    ME: 'me',
  },
  USERS: {
    PREFIX: 'users',
    OPTIONS: 'options',
    BY_ID: RESOURCE_ID_PATH,
    REACTIVATE: `${RESOURCE_ID_PATH}/reactivate`,
  },
  PARTIES: { PREFIX: 'parties', BY_ID: RESOURCE_ID_PATH },
  DEBTS: { PREFIX: 'debts', BY_ID: RESOURCE_ID_PATH, PAYMENTS: `${RESOURCE_ID_PATH}/payments` },
  PAYMENTS: { PREFIX: 'payments', AUTO_ALLOCATE: 'auto-allocate', BY_ID: RESOURCE_ID_PATH },
  CATALOG: { PREFIX: 'catalog', OPTIONS: 'options' },
  DASHBOARD: { PREFIX: 'dashboard' },
  REPORTS: { PREFIX: 'reports', AGING: 'aging' },
  EXPORTS: { PREFIX: 'exports', DEBTS: 'debts' },
  IMPORTS: { PREFIX: 'imports', DEBTS: 'debts' },
  AUDIT_LOGS: { PREFIX: 'audit-logs' },
} as const;
