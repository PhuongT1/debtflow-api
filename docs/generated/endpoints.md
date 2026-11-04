# Endpoint catalog

> Generated from Nest/OpenAPI by `npm run docs:generate`. Do not edit by hand.
> Path segments: `src/common/constants/api-routes.constants.ts`; HTTP methods and handlers: feature controllers.

See [full API reference](./api-reference.md) for DTOs, filters, examples and responses.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Log in with email and password (Auth) |
| POST | `/api/auth/switch-organization` | All members | Switch the active organization (Auth) |
| POST | `/api/auth/refresh` | Public | Exchange a refresh token for a new token pair (Auth) |
| GET | `/api/auth/me` | All members | Get the current user and their organizations (Auth) |
| GET | `/api/users/options` | All members | List members as select options (Users) |
| GET | `/api/users` | All members | List organization members (Users) |
| POST | `/api/users` | Roles: OWNER, ADMIN | Create a member (Users) |
| PATCH | `/api/users/{id}` | Roles: OWNER, ADMIN | Update a member (Users) |
| DELETE | `/api/users/{id}` | Roles: OWNER, ADMIN | Suspend a member (Users) |
| POST | `/api/users/{id}/reactivate` | Roles: OWNER, ADMIN | Reactivate a member (Users) |
| GET | `/api/parties` | All members | List customers and suppliers (Parties) |
| POST | `/api/parties` | Roles: OWNER, ADMIN, ACCOUNTANT | Create a party (Parties) |
| GET | `/api/parties/{id}` | All members | Get party detail (Parties) |
| PATCH | `/api/parties/{id}` | Roles: OWNER, ADMIN, ACCOUNTANT | Update a party (Parties) |
| DELETE | `/api/parties/{id}` | Roles: OWNER, ADMIN, ACCOUNTANT | Deactivate a party (Parties) |
| GET | `/api/catalog/options` | All members | Get filter options (Catalog) |
| GET | `/api/debts` | All members | List debts (Debts) |
| POST | `/api/debts` | Roles: OWNER, ADMIN, ACCOUNTANT | Create a debt (Debts) |
| GET | `/api/debts/{id}` | All members | Get debt detail (Debts) |
| PATCH | `/api/debts/{id}` | Roles: OWNER, ADMIN, ACCOUNTANT | Update collection information (Debts) |
| DELETE | `/api/debts/{id}` | Roles: OWNER, ADMIN, ACCOUNTANT | Cancel a debt (Debts) |
| POST | `/api/debts/{id}/payments` | Roles: OWNER, ADMIN, ACCOUNTANT | Record a payment against one debt (Debts) |
| GET | `/api/payments` | All members | List payments (Payments) |
| POST | `/api/payments/auto-allocate` | Roles: OWNER, ADMIN, ACCOUNTANT | Record a payment and auto-allocate it (Payments) |
| DELETE | `/api/payments/{id}` | Roles: OWNER, ADMIN, ACCOUNTANT | Reverse (delete) a payment (Payments) |
| GET | `/api/dashboard` | All members | Get dashboard summary (Dashboard) |
| GET | `/api/reports/aging` | All members | Aging report (Reports) |
| GET | `/api/exports/debts` | All members | Export debts to Excel (Exports) |
| POST | `/api/imports/debts` | Roles: ADMIN, ACCOUNTANT | Import debts from Excel (scaffold) (Imports) |
| GET | `/api/audit-logs` | Roles: OWNER, ADMIN | List audit log entries of the current organization (Audit logs) |
