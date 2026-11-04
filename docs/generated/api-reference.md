# API Reference

> Generated from the OpenAPI document by `npm run docs:generate`. Do not edit by hand.
> Fix the controller decorators or DTOs instead, then regenerate.

**Sales Debt Management API** v0.1.0 - 30 endpoints.
Base URL: `http://localhost:4000/api`. Interactive docs: `/docs`. Raw spec: [openapi.json](./openapi.json).

## Conventions

- Protected endpoints need `Authorization: Bearer <access token>`. The token carries the active organization, so every query is tenant-scoped automatically.
- "Roles" lists the organization roles allowed. `All members` means any authenticated active member (including `VIEWER`).
- JSON responses use the envelope described in [api-response-format](../guides/api-response-format.md).
- Send `Accept-Language: en` or `vi` (default `vi`) to localize messages: [localization](../guides/localization.md).
- List endpoints accept `sort` and `filter[field][op]=value`: [list query](../guides/list-query.md).

## Endpoint index

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

## Auth

### POST `/api/auth/login`

**Log in with email and password**

organizationId is optional. When omitted, the earliest created active membership in an active organization is selected. The returned access token contains the selected organization context.

- Access: Public

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string (email) | yes | Login email. |
| `password` | string | yes | Account password. |
| `organizationId` | string | no | Optional. Omit to select the earliest created active membership in an active organization. Supply a real organization ID only to choose a specific workspace you belong to; do not send the placeholder "string". |

### POST `/api/auth/switch-organization`

**Switch the active organization**

Issues a new token pair scoped to another organization the user belongs to.

- Access: All members

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `organizationId` | string | yes |  |

### POST `/api/auth/refresh`

**Exchange a refresh token for a new token pair**

- Access: Public

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `refreshToken` | string | yes |  |

### GET `/api/auth/me`

**Get the current user and their organizations**

- Access: All members

## Users

### GET `/api/users/options`

**List members as select options**

Lightweight list of active members used by assignee pickers.

- Access: All members

### GET `/api/users`

**List organization members**

Paginated members of the current organization. `status` is the effective status; `membershipStatus` and `userStatus` give the details.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `q` | query | string | no | Search over name, email and phone (case-insensitive). |
| `role` | query | `OWNER` \| `ADMIN` \| `ACCOUNTANT` \| `VIEWER` | no | Only members with this role. |
| `status` | query | `ACTIVE` \| `INACTIVE` | no | Effective status: `ACTIVE` = active membership of an active account, `INACTIVE` = anything else (suspended or invited membership, or a disabled account). |
| `membershipStatus` | query | `INVITED` \| `ACTIVE` \| `SUSPENDED` | no | Exact membership status in this organization. |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `name` \| `email` \| `phone` \| `userStatus` \| `role` \| `membershipStatus` \| `joinedAt` \| `createdAt` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[name]` | query | string | no |  Type: string. Use `filter[name][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[email]` | query | string | no |  Type: string. Use `filter[email][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[phone]` | query | string | no |  Type: string. Use `filter[phone][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[userStatus]` | query | string | no |  Type: enum. Values: ACTIVE, INACTIVE. Use `filter[userStatus][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[role]` | query | string | no |  Type: enum. Values: OWNER, ADMIN, ACCOUNTANT, VIEWER. Use `filter[role][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[membershipStatus]` | query | string | no |  Type: enum. Values: INVITED, ACTIVE, SUSPENDED. Use `filter[membershipStatus][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[joinedAt]` | query | string | no |  Type: date. Use `filter[joinedAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |

### POST `/api/users`

**Create a member**

Creates a new account with an initial password and adds it to the organization as an ACTIVE member. Only an OWNER can create another OWNER.

- Access: Roles: OWNER, ADMIN

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes |  |
| `email` | string (email) | yes | Login email. Stored lower-cased; must not belong to another account. |
| `phone` | string | no |  |
| `password` | string | yes | Initial password, hashed before storage. 8-72 characters with a letter and a digit. |
| `role` | `OWNER` \| `ADMIN` \| `ACCOUNTANT` \| `VIEWER` | yes | Role in this organization. Only an OWNER can create another OWNER. |

### PATCH `/api/users/{id}`

**Update a member**

Changes the role in this organization and/or the name and phone. Name and phone belong to the account, so they can only be edited by the user themselves or, for an account that belongs to no other organization, by an admin. You cannot change your own role; touching or granting OWNER requires an OWNER.

- Access: Roles: OWNER, ADMIN

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes | User id (the `id` returned by the list). |

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no | Full name. Editable only when the account belongs to this organization alone (or by the user themselves). |
| `phone` | string | no | Phone number, `null` clears it. Same restriction as `name`. |
| `role` | `OWNER` \| `ADMIN` \| `ACCOUNTANT` \| `VIEWER` | no | New role in this organization. Granting or removing OWNER requires an OWNER, and you cannot change your own role. |

### DELETE `/api/users/{id}`

**Suspend a member**

Sets the membership to SUSPENDED: the user can no longer use this organization. The account and its other organizations are untouched. You cannot suspend yourself; suspending an OWNER requires an OWNER.

- Access: Roles: OWNER, ADMIN

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes | User id (the `id` returned by the list). |

### POST `/api/users/{id}/reactivate`

**Reactivate a member**

Sets a suspended or invited membership back to ACTIVE.

- Access: Roles: OWNER, ADMIN

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes | User id (the `id` returned by the list). |

## Parties

### GET `/api/parties`

**List customers and suppliers**

Paginated list of active parties. Each item includes the outstanding receivable/payable `balance`. `sortBy=receivable|payable|outstandingDocuments` sort by derived values.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `q` | query | string | no | Accent-insensitive search over name, code, phone and tax code. |
| `type` | query | `CUSTOMER` \| `SUPPLIER` \| `BOTH` | no | Only customers, suppliers or both. |
| `assignedToId` | query | string | no | Only parties assigned to this member. |
| `balanceType` | query | `RECEIVABLE` \| `PAYABLE` | no | Only parties that still have unsettled debts of this direction. |
| `createdRange` | query | `today` \| `last_7_days` \| `this_month` | no | Shortcut for the creation date window, used when `createdFrom`/`createdTo` are absent. |
| `createdFrom` | query | string | no | Created on or after this date (`YYYY-MM-DD`). |
| `createdTo` | query | string | no | Created on or before this date (`YYYY-MM-DD`). |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `name` \| `code` \| `type` \| `phone` \| `email` \| `taxCode` \| `provinceName` \| `creditLimit` \| `isActive` \| `createdAt` \| `updatedAt` \| `outstandingDocuments` \| `receivable` \| `payable` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[name]` | query | string | no |  Type: string. Use `filter[name][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[code]` | query | string | no |  Type: string. Use `filter[code][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[type]` | query | string | no |  Type: enum. Values: CUSTOMER, SUPPLIER, BOTH. Use `filter[type][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[phone]` | query | string | no |  Type: string. Use `filter[phone][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[email]` | query | string | no |  Type: string. Use `filter[email][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[taxCode]` | query | string | no |  Type: string. Use `filter[taxCode][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[provinceCode]` | query | string | no |  Type: string. Use `filter[provinceCode][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[provinceName]` | query | string | no |  Type: string. Use `filter[provinceName][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[creditLimit]` | query | string | no |  Type: decimal. Use `filter[creditLimit][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[assignedToId]` | query | string | no |  Type: string. Use `filter[assignedToId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[updatedAt]` | query | string | no |  Type: date. Use `filter[updatedAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |

### POST `/api/parties`

**Create a party**

The `code` is optional but unique per organization. `assignedToId` must be an active member of the organization.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `CUSTOMER` \| `SUPPLIER` \| `BOTH` | yes | Customer, supplier, or both. |
| `code` | string | no | Optional business code, unique within the organization. |
| `name` | string | yes | Display name. |
| `phone` | string | no |  |
| `email` | string (email) | no | Stored lower-cased. |
| `taxCode` | string | no |  |
| `address` | string | no |  |
| `note` | string | no |  |
| `provinceCode` | string | no | Province code, stored upper-case. |
| `provinceName` | string | no |  |
| `creditLimit` | string | no | Maximum outstanding receivable allowed for this party, as a decimal string (>= 0). |
| `assignedToId` | string | no | Id of an active member of the organization responsible for this party. |

### GET `/api/parties/{id}`

**Get party detail**

Includes the assignee and all debts, nearest due date first.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes | Party id. |

### PATCH `/api/parties/{id}`

**Update a party**

Partial update: only the fields you send change. A blank or null value clears an optional field; `name` and `type` cannot be cleared.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes | Party id. |

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `CUSTOMER` \| `SUPPLIER` \| `BOTH` | no | Customer, supplier, or both. |
| `code` | string | no | Optional business code, unique within the organization. |
| `name` | string | no | Display name. |
| `phone` | string | no |  |
| `email` | string (email) | no | Stored lower-cased. |
| `taxCode` | string | no |  |
| `address` | string | no |  |
| `note` | string | no |  |
| `provinceCode` | string | no | Province code, stored upper-case. |
| `provinceName` | string | no |  |
| `creditLimit` | string | no | Maximum outstanding receivable allowed for this party, as a decimal string (>= 0). |
| `assignedToId` | string | no | Id of an active member of the organization responsible for this party. |

### DELETE `/api/parties/{id}`

**Deactivate a party**

Soft delete (`isActive=false`). Rejected while the party has unsettled debts.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes | Party id. |

## Catalog

### GET `/api/catalog/options`

**Get filter options**

Active categories, brands, products and the provinces that have parties.

- Access: All members

## Debts

### GET `/api/debts`

**List debts**

Paginated list with filters for type, status, collection status, party, product, aging bucket, due date range and follow-up.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `aging` | query | `not_due` \| `1_7` \| `8_30` \| `31_60` \| `60_plus` | no | Vietnam calendar-day aging; due today is not overdue. |
| `q` | query | string | no |  |
| `type` | query | `RECEIVABLE` \| `PAYABLE` | no |  |
| `status` | query | `OPEN` \| `PARTIAL` \| `PAID` \| `CANCELLED` | no |  |
| `collectionStatus` | query | `NEW` \| `CONTACTED` \| `PROMISED` \| `DISPUTED` \| `ESCALATED` | no |  |
| `partyId` | query | string | no |  |
| `provinceCode` | query | string | no |  |
| `categoryId` | query | string | no |  |
| `brandId` | query | string | no |  |
| `productId` | query | string | no |  |
| `salesChannel` | query | `STORE` \| `ONLINE` \| `WHOLESALE` | no |  |
| `assignedToId` | query | string | no |  |
| `followUp` | query | `today` \| `overdue` \| `upcoming` | no |  |
| `dueRange` | query | `today` \| `tomorrow` \| `next_7_days` \| `this_month` | no |  |
| `dueDate` | query | string | no |  |
| `dueDateFrom` | query | string | no |  |
| `dueDateTo` | query | string | no |  |
| `overdue` | query | `true` \| `false` | no |  |
| `outstanding` | query | `true` \| `false` | no |  |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `code` \| `title` \| `type` \| `status` \| `collectionStatus` \| `salesChannel` \| `partyName` \| `invoiceNo` \| `orderNo` \| `contractNo` \| `poNo` \| `originalAmount` \| `paidAmount` \| `issueDate` \| `dueDate` \| `nextFollowUpAt` \| `createdAt` \| `updatedAt` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[code]` | query | string | no |  Type: string. Use `filter[code][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[title]` | query | string | no |  Type: string. Use `filter[title][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[type]` | query | string | no |  Type: enum. Values: RECEIVABLE, PAYABLE. Use `filter[type][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[status]` | query | string | no |  Type: enum. Values: OPEN, PARTIAL, PAID, CANCELLED. Use `filter[status][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[collectionStatus]` | query | string | no |  Type: enum. Values: NEW, CONTACTED, PROMISED, DISPUTED, ESCALATED. Use `filter[collectionStatus][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[salesChannel]` | query | string | no |  Type: enum. Values: STORE, ONLINE, WHOLESALE. Use `filter[salesChannel][op]=value`, op: eq, notEq, in, notIn, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyId]` | query | string | no |  Type: string. Use `filter[partyId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyName]` | query | string | no |  Type: string. Use `filter[partyName][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[assignedToId]` | query | string | no |  Type: string. Use `filter[assignedToId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[invoiceNo]` | query | string | no |  Type: string. Use `filter[invoiceNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[orderNo]` | query | string | no |  Type: string. Use `filter[orderNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[contractNo]` | query | string | no |  Type: string. Use `filter[contractNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[poNo]` | query | string | no |  Type: string. Use `filter[poNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[originalAmount]` | query | string | no |  Type: decimal. Use `filter[originalAmount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[paidAmount]` | query | string | no |  Type: decimal. Use `filter[paidAmount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[issueDate]` | query | string | no |  Type: date. Use `filter[issueDate][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[dueDate]` | query | string | no |  Type: date. Use `filter[dueDate][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[nextFollowUpAt]` | query | string | no |  Type: date. Use `filter[nextFollowUpAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[updatedAt]` | query | string | no |  Type: date. Use `filter[updatedAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |

### POST `/api/debts`

**Create a debt**

Creates a receivable or payable with an auto-generated code (CN-YYYYMM-NNNN). dueDate must not be before issueDate.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `RECEIVABLE` \| `PAYABLE` | yes |  |
| `partyId` | string | yes |  |
| `assignedToId` | string | no |  |
| `title` | string | yes |  |
| `invoiceNo` | string | no |  |
| `orderNo` | string | no |  |
| `contractNo` | string | no |  |
| `poNo` | string | no |  |
| `description` | string | no |  |
| `salesChannel` | `STORE` \| `ONLINE` \| `WHOLESALE` | no |  |
| `items` | `CreateDebtItemDto`[] | no |  |
| `originalAmount` | string | yes |  |
| `issueDate` | string | yes |  |
| `dueDate` | string | yes |  |
| `nextFollowUpAt` | string | no |  |
| `followUpNote` | string | no |  |

### GET `/api/debts/{id}`

**Get debt detail**

Includes party, assignee, line items and the payments applied to the debt.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes |  |

### PATCH `/api/debts/{id}`

**Update collection information**

Updates the assignee, collection status, follow-up schedule and reference numbers. Amounts and status are not editable here.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes |  |

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `assignedToId` | string | no |  |
| `nextFollowUpAt` | string | no |  |
| `followUpNote` | string | no |  |
| `invoiceNo` | string | no |  |
| `orderNo` | string | no |  |
| `contractNo` | string | no |  |
| `poNo` | string | no |  |
| `description` | string | no |  |
| `collectionStatus` | `NEW` \| `CONTACTED` \| `PROMISED` \| `DISPUTED` \| `ESCALATED` | no |  |

### DELETE `/api/debts/{id}`

**Cancel a debt**

Sets status to CANCELLED. Rejected when the debt already has payments.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes |  |

### POST `/api/debts/{id}/payments`

**Record a payment against one debt**

Rejected when the debt is PAID or CANCELLED, or when the amount exceeds the remaining balance.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes |  |

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | string | yes |  |
| `paidAt` | string | yes |  |
| `method` | `CASH` \| `BANK_TRANSFER` \| `OTHER` | no |  |
| `referenceNo` | string | no |  |
| `note` | string | no |  |

## Payments

### GET `/api/payments`

**List payments**

Paginated vouchers with their allocations. Filter by partyId or debtId.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `debtId` | query | string | no |  |
| `partyId` | query | string | no |  |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `type` \| `method` \| `amount` \| `paidAt` \| `referenceNo` \| `partyName` \| `createdAt` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[type]` | query | string | no |  Type: enum. Values: RECEIVABLE, PAYABLE. Use `filter[type][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[method]` | query | string | no |  Type: enum. Values: CASH, BANK_TRANSFER, OTHER. Use `filter[method][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[amount]` | query | string | no |  Type: decimal. Use `filter[amount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[paidAt]` | query | string | no |  Type: date. Use `filter[paidAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[referenceNo]` | query | string | no |  Type: string. Use `filter[referenceNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyId]` | query | string | no |  Type: string. Use `filter[partyId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyName]` | query | string | no |  Type: string. Use `filter[partyName][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |

### POST `/api/payments/auto-allocate`

**Record a payment and auto-allocate it**

Applies the amount to the party's OPEN/PARTIAL debts of the given type, oldest due date first. Rejected when the amount exceeds the party's total remaining balance.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | string | yes |  |
| `paidAt` | string | yes |  |
| `method` | `CASH` \| `BANK_TRANSFER` \| `OTHER` | no |  |
| `referenceNo` | string | no |  |
| `note` | string | no |  |
| `partyId` | string | yes |  |
| `type` | `RECEIVABLE` \| `PAYABLE` | yes |  |

### DELETE `/api/payments/{id}`

**Reverse (delete) a payment**

Deletes the voucher and subtracts its allocations from each debt, recomputing OPEN/PARTIAL/PAID.

- Access: Roles: OWNER, ADMIN, ACCOUNTANT

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | string | yes |  |

## Dashboard

### GET `/api/dashboard`

**Get dashboard summary**

Receivable and payable totals, overdue count, action center (follow-ups and due soon), recent payments and the nearest unsettled debts.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `dateFrom` | query | string | no |  |
| `dateTo` | query | string | no |  |

## Reports

### GET `/api/reports/aging`

**Aging report**

Remaining balance across all matching open/partial debts, grouped by whole elapsed 24-hour days: less than 1, 1-7, 8-30, 31-60 and 61+ days overdue. Accepts the same query filters as GET /debts. page, pageSize and sort are accepted for compatibility but do not limit or order the totals.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `aging` | query | `not_due` \| `1_7` \| `8_30` \| `31_60` \| `60_plus` | no | Vietnam calendar-day aging; due today is not overdue. |
| `q` | query | string | no |  |
| `type` | query | `RECEIVABLE` \| `PAYABLE` | no |  |
| `status` | query | `OPEN` \| `PARTIAL` \| `PAID` \| `CANCELLED` | no |  |
| `collectionStatus` | query | `NEW` \| `CONTACTED` \| `PROMISED` \| `DISPUTED` \| `ESCALATED` | no |  |
| `partyId` | query | string | no |  |
| `provinceCode` | query | string | no |  |
| `categoryId` | query | string | no |  |
| `brandId` | query | string | no |  |
| `productId` | query | string | no |  |
| `salesChannel` | query | `STORE` \| `ONLINE` \| `WHOLESALE` | no |  |
| `assignedToId` | query | string | no |  |
| `followUp` | query | `today` \| `overdue` \| `upcoming` | no |  |
| `dueRange` | query | `today` \| `tomorrow` \| `next_7_days` \| `this_month` | no |  |
| `dueDate` | query | string | no |  |
| `dueDateFrom` | query | string | no |  |
| `dueDateTo` | query | string | no |  |
| `overdue` | query | `true` \| `false` | no |  |
| `outstanding` | query | `true` \| `false` | no |  |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `code` \| `title` \| `type` \| `status` \| `collectionStatus` \| `salesChannel` \| `partyName` \| `invoiceNo` \| `orderNo` \| `contractNo` \| `poNo` \| `originalAmount` \| `paidAmount` \| `issueDate` \| `dueDate` \| `nextFollowUpAt` \| `createdAt` \| `updatedAt` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[code]` | query | string | no |  Type: string. Use `filter[code][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[title]` | query | string | no |  Type: string. Use `filter[title][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[type]` | query | string | no |  Type: enum. Values: RECEIVABLE, PAYABLE. Use `filter[type][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[status]` | query | string | no |  Type: enum. Values: OPEN, PARTIAL, PAID, CANCELLED. Use `filter[status][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[collectionStatus]` | query | string | no |  Type: enum. Values: NEW, CONTACTED, PROMISED, DISPUTED, ESCALATED. Use `filter[collectionStatus][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[salesChannel]` | query | string | no |  Type: enum. Values: STORE, ONLINE, WHOLESALE. Use `filter[salesChannel][op]=value`, op: eq, notEq, in, notIn, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyId]` | query | string | no |  Type: string. Use `filter[partyId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyName]` | query | string | no |  Type: string. Use `filter[partyName][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[assignedToId]` | query | string | no |  Type: string. Use `filter[assignedToId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[invoiceNo]` | query | string | no |  Type: string. Use `filter[invoiceNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[orderNo]` | query | string | no |  Type: string. Use `filter[orderNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[contractNo]` | query | string | no |  Type: string. Use `filter[contractNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[poNo]` | query | string | no |  Type: string. Use `filter[poNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[originalAmount]` | query | string | no |  Type: decimal. Use `filter[originalAmount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[paidAmount]` | query | string | no |  Type: decimal. Use `filter[paidAmount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[issueDate]` | query | string | no |  Type: date. Use `filter[issueDate][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[dueDate]` | query | string | no |  Type: date. Use `filter[dueDate][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[nextFollowUpAt]` | query | string | no |  Type: date. Use `filter[nextFollowUpAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[updatedAt]` | query | string | no |  Type: date. Use `filter[updatedAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |

## Exports

### GET `/api/exports/debts`

**Export debts to Excel**

Streams an .xlsx file (not wrapped in the JSON envelope). Accepts the same query filters as GET /debts, up to 1000 rows.

- Access: All members

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `aging` | query | `not_due` \| `1_7` \| `8_30` \| `31_60` \| `60_plus` | no | Vietnam calendar-day aging; due today is not overdue. |
| `q` | query | string | no |  |
| `type` | query | `RECEIVABLE` \| `PAYABLE` | no |  |
| `status` | query | `OPEN` \| `PARTIAL` \| `PAID` \| `CANCELLED` | no |  |
| `collectionStatus` | query | `NEW` \| `CONTACTED` \| `PROMISED` \| `DISPUTED` \| `ESCALATED` | no |  |
| `partyId` | query | string | no |  |
| `provinceCode` | query | string | no |  |
| `categoryId` | query | string | no |  |
| `brandId` | query | string | no |  |
| `productId` | query | string | no |  |
| `salesChannel` | query | `STORE` \| `ONLINE` \| `WHOLESALE` | no |  |
| `assignedToId` | query | string | no |  |
| `followUp` | query | `today` \| `overdue` \| `upcoming` | no |  |
| `dueRange` | query | `today` \| `tomorrow` \| `next_7_days` \| `this_month` | no |  |
| `dueDate` | query | string | no |  |
| `dueDateFrom` | query | string | no |  |
| `dueDateTo` | query | string | no |  |
| `overdue` | query | `true` \| `false` | no |  |
| `outstanding` | query | `true` \| `false` | no |  |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `code` \| `title` \| `type` \| `status` \| `collectionStatus` \| `salesChannel` \| `partyName` \| `invoiceNo` \| `orderNo` \| `contractNo` \| `poNo` \| `originalAmount` \| `paidAmount` \| `issueDate` \| `dueDate` \| `nextFollowUpAt` \| `createdAt` \| `updatedAt` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[code]` | query | string | no |  Type: string. Use `filter[code][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[title]` | query | string | no |  Type: string. Use `filter[title][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[type]` | query | string | no |  Type: enum. Values: RECEIVABLE, PAYABLE. Use `filter[type][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[status]` | query | string | no |  Type: enum. Values: OPEN, PARTIAL, PAID, CANCELLED. Use `filter[status][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[collectionStatus]` | query | string | no |  Type: enum. Values: NEW, CONTACTED, PROMISED, DISPUTED, ESCALATED. Use `filter[collectionStatus][op]=value`, op: eq, notEq, in, notIn (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[salesChannel]` | query | string | no |  Type: enum. Values: STORE, ONLINE, WHOLESALE. Use `filter[salesChannel][op]=value`, op: eq, notEq, in, notIn, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyId]` | query | string | no |  Type: string. Use `filter[partyId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[partyName]` | query | string | no |  Type: string. Use `filter[partyName][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[assignedToId]` | query | string | no |  Type: string. Use `filter[assignedToId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[invoiceNo]` | query | string | no |  Type: string. Use `filter[invoiceNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[orderNo]` | query | string | no |  Type: string. Use `filter[orderNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[contractNo]` | query | string | no |  Type: string. Use `filter[contractNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[poNo]` | query | string | no |  Type: string. Use `filter[poNo][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[originalAmount]` | query | string | no |  Type: decimal. Use `filter[originalAmount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[paidAmount]` | query | string | no |  Type: decimal. Use `filter[paidAmount][op]=value`, op: eq, notEq, in, notIn, lt, lte, gt, gte, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[issueDate]` | query | string | no |  Type: date. Use `filter[issueDate][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[dueDate]` | query | string | no |  Type: date. Use `filter[dueDate][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[nextFollowUpAt]` | query | string | no |  Type: date. Use `filter[nextFollowUpAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[updatedAt]` | query | string | no |  Type: date. Use `filter[updatedAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |

## Imports

### POST `/api/imports/debts`

**Import debts from Excel (scaffold)**

Not implemented yet: returns a placeholder message and imports nothing.

- Access: Roles: ADMIN, ACCOUNTANT

## Audit logs

### GET `/api/audit-logs`

**List audit log entries of the current organization**

- Access: Roles: OWNER, ADMIN

| Parameter | In | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `actorId` | query | string | no |  |
| `entityType` | query | string | no |  |
| `entityId` | query | string | no |  |
| `action` | query | string | no |  |
| `page` | query | number | no |  |
| `pageSize` | query | number | no |  |
| `sortBy` | query | `entityType` \| `action` \| `createdAt` | no | One field to sort by. Omit to use the endpoint default order. |
| `sortOrder` | query | `asc` \| `desc` | no | Direction used with `sortBy`. Default asc. |
| `filterOperator` | query | `AND` \| `OR` | no | How the `filter[...]` conditions are combined. Default AND. |
| `filter[actorId]` | query | string | no |  Type: string. Use `filter[actorId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith, isNull (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[entityType]` | query | string | no |  Type: string. Use `filter[entityType][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[entityId]` | query | string | no |  Type: string. Use `filter[entityId][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[action]` | query | string | no |  Type: string. Use `filter[action][op]=value`, op: eq, notEq, in, notIn, contains, notContains, startsWith, endsWith (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
| `filter[createdAt]` | query | string | no |  Type: date. Use `filter[createdAt][op]=value`, op: eq, lt, lte, gt, gte, before, after, between (no op means eq; `in`, `notIn` and `between` take comma-separated values). |
