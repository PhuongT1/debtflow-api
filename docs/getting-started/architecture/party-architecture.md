# Ví dụ thực tế: module Party

Party áp dụng [Clean Architecture của DebtFlow](./clean-architecture.md) trong một module NestJS. Đọc [request flow](./request-flow.md) để hiểu guard, validation và response envelope, rồi mở các file trong `src/modules/parties/` theo thứ tự ở trang này.

## Các layer của Party và file tương ứng

Party là module đầu tiên áp dụng **Clean Architecture với core độc lập Nest/Prisma**.
Các module khác vẫn theo ranh giới repository hiện có; chưa được chuyển đồng loạt.

| Layer          | File sở hữu                                                                                                                              | Phụ thuộc được phép                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Presentation   | `presentation/parties.controller.ts`, `presentation/dto/`, `presentation/party-response.mapper.ts`                                                | Application contracts, HTTP validation, Swagger và response mapping    |
| Application    | `application/parties.service.ts`, `application/repositories/parties.repository.ts`                                                       | Domain rules/types và các application port, không Nest/DTO/Prisma      |
| Domain         | `domain/party.rules.ts`                                                                                         | Quy tắc thuần: điều kiện deactivate      |
| Infrastructure | `infrastructure/prisma-parties.repository.ts`, `infrastructure/queries/`, `infrastructure/sql/`, `infrastructure/party-audit.adapter.ts` | Prisma/DB, SQL, EventEmitter2; triển khai contract bên trong           |
| Composition    | `parties.module.ts`                                                                                                                      | Nối repository và audit adapter bằng factory của Nest |
| Cấu hình adapter | `party.list-query.ts` | Allow-list dùng chung HTTP/Prisma, không được import vào core |

Không tạo thêm lớp `PartyEntity` chỉ để bọc record CRUD. Quy tắc thuần vẫn là domain logic dù không
có class entity. Core không nhận `Request`, DTO class, Prisma delegate, `where` hoặc `orderBy`.
Kiểm tra người phụ trách dùng `PartyWriteStore` trong cùng transaction với thao tác ghi.
Audit đi qua `PartyAudit` sau commit.

```mermaid
flowchart LR
  subgraph Presentation
    C[presentation: Controller / DTO / response mapper]
  end
  subgraph Application
    S[application: PartiesService]
    P[Repository / audit ports]
  end
  subgraph Domain
    D[domain: party.rules.ts]
  end
  subgraph Infrastructure
    I[Prisma repository / audit adapter]
  end
  C --> S
  S --> P
  S --> D
  I -. implements .-> P
  I --> DB[(PostgreSQL)]
```

Mũi tên trên mô tả **chiều phụ thuộc code**. Runtime vẫn gọi controller → service → implementation
được Nest nối vào port. Dependency từ infrastructure hướng vào contract; core không import adapter.

## Ví dụ: FE lấy danh sách đối tác

```http
GET /api/parties?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <access-token>
```

Guard, validation và interceptor dùng chung chạy theo [flow chung](./request-flow.md).
Sơ đồ dưới đây đi sâu vào **nhánh sort `createdAt`, trang có dữ liệu** của request mẫu.

Request GET list đi qua **Presentation**, **Application** và **Infrastructure**. Application kiểm tra tenant context;
GET này không cần gọi domain rule. Ví dụ ghi bên dưới cho thấy đủ bốn layer khi có quy tắc nghiệp vụ.
Các quy tắc của thao tác ghi cũng nằm ở domain, không có truy vấn DB trong domain.
Khung ở đầu sơ đồ nhóm các thành phần cùng tầng; tên tầng nằm ngay trong khung.
PostgreSQL là cơ sở dữ liệu mà ứng dụng kết nối để đọc và ghi dữ liệu.

Khi khởi động, `parties.module.ts` bind `PartiesRepository` với `PrismaPartiesRepository`.
Khi nhận request, service gọi adapter đã được inject; abstract contract không phải một bước chạy riêng.

```mermaid
---
config:
  sequence:
    mirrorActors: false
    height: 65
    boxTextMargin: 10
  themeCSS: |
    /* Frame only the layer heading and participant names, not their lifelines. */
    .rect[fill="transparent"] { height: 110px; rx: 6px; stroke: #8b83a7 !important; stroke-width: 1px; }
    .rect[fill="transparent"] + .text { font-weight: 700 !important; }
---
sequenceDiagram
  participant FE as FE / API client
  box transparent Presentation — HTTP
    participant C as PartiesController
  end
  box transparent Application — nghiệp vụ
    participant S as PartiesService
  end
  box transparent Infrastructure — truy cập DB
    participant R as PrismaPartiesRepository
    participant P as PrismaService<br/>PrismaPg / pg
  end
  box transparent Database — cơ sở dữ liệu
    participant DB as PostgreSQL
  end
  FE->>C: Input đã qua pipeline chung
  C->>S: list(organizationId, query, listQuery)
  S->>S: Kiểm tra tenant context bắt buộc
  S->>R: repository.list(...)
  R->>R: Tenant, pagination, where, orderBy
  R->>P: $transaction: RepeatableRead
  R->>P: tx.party.count({ where })
  P->>DB: Đếm Party theo tenant + filters
  DB-->>P: total
  P-->>R: total
  R->>P: tx.party.findMany(...)
  P->>DB: Lấy trang + relations đã chọn
  DB-->>P: Records
  P-->>R: page
  R->>P: withBalances → tx.debt.groupBy(...)
  P->>DB: Aggregate công nợ cho ID trong trang
  DB-->>P: Decimal aggregates
  P-->>R: balances
  R->>R: Decimal → string, ghép balance, paginate
  P-->>R: Transaction hoàn tất
  R-->>S: PaginatedResult
  S-->>C: PaginatedResult
  C->>C: page.items.map(toPartyListItem)
  C-->>FE: Interceptor → JSON envelope
```

- Ba lần đọc count / page / balance dùng cùng transaction client `tx`, cùng snapshot.
- `findMany` sort `createdAt DESC, id ASC`, dùng `skip` / `take`; projection có assignee và số nợ.
- Balance chỉ cộng nợ `OPEN` / `PARTIAL` của tenant và các Party trong trang.
- Nếu `skip >= total`, adapter trả trang rỗng ngay sau count, không đọc page / balance.
- Sau mapper, `ApiResponseInterceptor` chuyển `items` thành `data`, thêm `meta.pagination` và các field envelope.
  Nếu có lỗi, request đi qua `ApiExceptionFilter` theo [flow lỗi](./request-flow.md).

**Infrastructure không phải một class chạy thêm sau repository.** `PrismaPartiesRepository`
là adapter nằm trong `infrastructure/`, triển khai abstract contract `PartiesRepository`.
Adapter gọi `PrismaService` dùng chung từ `src/database/`; Prisma dùng adapter `PrismaPg` và driver
`pg` để giao tiếp PostgreSQL. Transaction client `tx` dùng cùng hạ tầng này, không tạo PrismaClient mới.

Sơ đồ mô tả các lời gọi chính, không phải phép đo số SQL statement. Prisma có thể sinh thêm
query cho relation. Count, page và balance được đọc trong cùng snapshot `RepeatableRead`.

## Mở file theo thứ tự này

| Bước | File / hàm                                                    | Vai trò                                                                |
| ---- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | `parties.module.ts`                                           | Bind `PartiesRepository` → `PrismaPartiesRepository` khi app khởi động |
| 2    | `presentation/parties.controller.ts` → `list()`               | Route, context và `@ListQueryCriteria(PARTY_LIST_QUERY)`                       |
| 3    | `presentation/dto/query-parties.dto.ts`                       | Validate page và các filter riêng của Party                            |
| 4    | `party.list-query.ts`                                         | Cho phép sort/filter field nào; dùng parser chung                      |
| 5    | `application/parties.service.ts` → `list()`                   | Yêu cầu tenant, gọi repository contract                                |
| 6    | `application/repositories/parties.repository.ts`              | Khai báo method; dùng Go to Implementations để tới adapter             |
| 7    | `infrastructure/prisma-parties.repository.ts` → `list()`      | Nơi gọi DB và mở snapshot transaction                                  |
| 8    | `infrastructure/queries/party-list.query.ts` → `buildPartyListQuery()` | Ghép tenant, filter riêng và dynamic filters                           |
| 9    | `infrastructure/queries/party.select.ts`                      | Projection Prisma và nguồn để suy ra payload types                     |
| 10   | `src/database/prisma.service.ts` (ngoài feature)              | PrismaClient dùng chung + PrismaPg / pg; thực thi query tới PostgreSQL |
| 11   | `presentation/party-response.mapper.ts` → `toPartyListItem()`          | Chọn field theo public contract; tiền đã là string ở adapter           |
| 12   | `presentation/dto/party-response.dto.ts`                      | Contract response cho Swagger; không tự thực thi mapper                |

`createdRange` lọc theo lịch Việt Nam. `today` lấy trọn ngày hiện tại, `last_7_days` gồm hôm nay
và sáu ngày trước, `this_month` lấy trọn tháng hiện tại. Khi có `createdFrom` hoặc `createdTo`,
truy vấn dùng mốc ngày được cung cấp và bỏ preset. Prisma và SQL aggregate dùng chung
điều kiện `createdAt` đã tính từ helper Luxon.

`createdAt` là cột DateTime: bộ sort chung dựng `orderBy`, PostgreSQL sắp xếp. Không có hàm sort
ngày riêng của Party. Đổi request sang `sortBy=receivable` sẽ dùng nhánh tính toán dưới đây.

## Nhánh sort công nợ khác ở đâu?

```mermaid
flowchart TD
  A["Cùng where từ buildPartyListQuery"] --> B["SQL: aggregate giá trị cần sort trên toàn tập phù hợp"]
  B --> C["Sort + ID tie-breaker → chọn trang"]
  C --> D["Tính hai balance cho trang đã chọn"]
  D --> E["Prisma: hydrate đúng các ID trong trang"]
  E --> F["Mapper và response như nhánh thông thường"]
```

Hai file trong `infrastructure/sql/` dựng SQL, không tự gọi DB:

- `party-balance-page.sql.ts`: aggregate, sort và chọn trang.
- `party-filter.sql.ts`: chuyển phần Prisma predicate được hỗ trợ sang SQL bind tham số.

`party.list-query.ts` là allow-list của request. `infrastructure/queries/` dựng Prisma arguments;
`infrastructure/sql/` dựng SQL PostgreSQL. Service chỉ nhận options sort/filter thuần; adapter mới
biên dịch chúng thành `where`/`orderBy`. Các field lọc vẫn được AND với tenant scope.
`outstandingDocuments` là tên sort cũ, đếm tất cả nợ của tenant, kể cả đã trả/hủy. Balance chỉ tính
nợ OPEN/PARTIAL. Không đổi ý nghĩa hai khái niệm này khi sửa query.

## Ví dụ ghi: cập nhật Party

```text
PATCH route + @Roles
  → UpdatePartyDto (validate HTTP, implements UpdatePartyInput)
  → PartiesService.update
  → repository.inTransaction: Serializable, retry tối đa 2 lần khi P2034
    → store.findRecord: snapshot scalar trong transaction, không tải lịch sử nợ
    → application/party-write.mapper.ts / buildPartyUpdateData: tính lại searchText từ snapshot mới nhất mỗi lần retry
    → store.hasActiveMember: kiểm tra assignee nếu có, dùng cùng transaction
    → store.update: write theo id và organizationId
  → commit thành công → PartyAudit.record → PartyAuditAdapter → emitAudit một lần
  → toPartyResponse → envelope chung
```

Omitted field giữ nguyên; optional null/blank có thể xóa giá trị. PATCH hiện bỏ qua null của name/type.
`application/party-read.types.ts` sở hữu record và kết quả đọc độc lập ORM. `application/party.inputs.ts` định nghĩa
Create/PATCH bằng `Pick`/`Partial` từ dữ liệu đó;
request DTO `implements` input nhưng vẫn giữ decorators validation. Adapter suy ra DB payload từ
Prisma select, chuyển tiền sang string và trả đúng contract. Swagger vẫn kế thừa generated `PartyBase`
qua `PickType`; `presentation/dto/party-response.fields.ts` sở hữu `PARTY_RESPONSE_FIELDS`, dùng chung cho Swagger và HTTP mapper.
Đây là hai contract có chủ đích: schema lưu trữ và dữ liệu ứng dụng; không dùng Prisma type để định
nghĩa core vì như vậy core lại phụ thuộc infrastructure.
Audit hiện là event trong process, không phải outbox bảo đảm lưu bền vững.

## Ví dụ đủ bốn layer: vô hiệu hóa Party

```mermaid
---
config:
  sequence:
    mirrorActors: false
    height: 65
    boxTextMargin: 10
  themeCSS: |
    /* Frame only the layer heading and participant names, not their lifelines. */
    .rect[fill="transparent"] { height: 110px; rx: 6px; stroke: #8b83a7 !important; stroke-width: 1px; }
    .rect[fill="transparent"] + .text { font-weight: 700 !important; }
---
sequenceDiagram
  participant FE as FE / API client
  box transparent Presentation — HTTP
    participant C as PartiesController
  end
  box transparent Application — use case
    participant S as PartiesService
  end
  box transparent Domain — quy tắc thuần
    participant D as canDeactivateParty
  end
  box transparent Infrastructure — adapters
    participant R as PrismaPartiesRepository
    participant A as PartyAuditAdapter
  end
  participant DB as PostgreSQL
  FE->>C: DELETE /api/parties/:id, qua guards
  C->>S: deactivate(organizationId, id, actorId)
  S->>S: Kiểm tra tenant context
  S->>R: inTransaction(work)
  R->>DB: Bắt đầu Serializable transaction
  S->>R: store.findRecord + countUnsettledDebts
  R->>DB: Đọc Party và số nợ đang mở trong tenant
  DB-->>R: Record + count
  R-->>S: Record + count
  S->>D: canDeactivateParty(unsettledDebtCount)
  D-->>S: true / false
  alt Có nợ đang mở
    S-->>R: Throw ApplicationError
    R->>DB: Rollback
    C-->>FE: Exception filter trả lỗi 400, không audit
  else Không có nợ đang mở
    S->>R: store.deactivate
    R->>DB: Update isActive=false theo tenant + id
    DB-->>R: Party đã cập nhật
    R->>DB: Commit
    R-->>S: Kết quả transaction
    S->>A: audit.record sau commit
    S-->>C: PartyRecord
    C-->>FE: Mapper + interceptor → response
  end
```

Domain chỉ quyết định `unsettledDebtCount === 0`; không biết SQL, HTTP hay audit.
Application map kết quả từ chối sang `ApplicationError` với error key hiện có. Adapter thực thi
transaction/retry; các attempt lỗi không phát audit. Sơ đồ thể hiện nhánh thành công/nghiệp vụ,
không liệt kê từng attempt retry hay mọi lỗi kết nối database.

## Khi bạn cần sửa hoặc thêm tính năng

| Việc cần sửa | Nơi bắt đầu |
| --- | --- |
| Route, vai trò hoặc Swagger | `presentation/parties.controller.ts`. Tham số tenant và actor đến từ context đã xác thực. |
| Field request hoặc response | DTO request trong `presentation/dto/`. Field response HTTP đi qua `party-response.fields.ts` và `toPartyResponse`, `toPartyListItem` hoặc `toPartyDetailResponse`. |
| Ý nghĩa của thao tác ghi | `application/parties.service.ts` điều phối `create`, `update`, `deactivate`. `party-write.mapper.ts` chuẩn hóa dữ liệu và giữ đúng ngữ nghĩa PATCH. Quy tắc thuần như `canDeactivateParty` nằm ở `domain/party.rules.ts`. |
| Kiểm tra người phụ trách | `assertActiveAssignee` gọi `PartyWriteStore.hasActiveMember` trên cùng transaction với thao tác ghi. Prisma adapter dùng `src/database/active-organization-member.query.ts`. |
| Filter, sort hoặc projection | `party.list-query.ts` khai báo khả năng của API. `buildPartyListQuery` dựng điều kiện Prisma. `party.select.ts` chọn field. `partyBalancePageSql` dựng câu lệnh tổng hợp và phân trang. |
| Kết nối adapter hoặc thêm test | `parties.module.ts` sở hữu DI. `_test/` chứa test rule, mapper, service/adapter, SQL builder và các suite PostgreSQL chạy theo yêu cầu. |

Tên file mô tả vai trò và phạm vi. `parties.controller.ts`, `parties.service.ts` và `parties.module.ts` theo tên resource `parties`. `party.rules.ts`, `party-write.mapper.ts` và `party.select.ts` mô tả quy tắc, mapping và projection của một Party. `prisma-parties.repository.ts` nêu rõ công nghệ adapter. `buildPartyListQuery` dựng Prisma arguments, còn `partyBalancePageSql` trả một SQL fragment để repository thực thi. Handler `remove` xử lý HTTP `DELETE` và gọi use case `deactivate`, tên thể hiện thao tác đổi `isActive` trong nghiệp vụ.

Lỗi nghiệp vụ dùng `ApplicationError` thuần và được `ApiExceptionFilter` chuyển thành HTTP status, code và bản dịch EN/VI. `check:architecture` kiểm tra chiều import, kể cả qua lớp trung gian. Xem thêm [cách chọn layer khi chỉnh module](../module-development.md#maintain-existing-feature).

## Bảo vệ dữ liệu và giới hạn hiện tại

Create, update và deactivate dùng `PartyWriteStore`: service không nhận Prisma client và không thể gọi
các thao tác ghi này ngoài transaction qua repository contract. Deactivate đọc Party, đếm nợ đang mở
và vô hiệu hóa trong cùng transaction `Serializable`; tạo nợ cũng dùng `Serializable`. Nếu hai luồng
xung đột, retry sẽ đọc lại trạng thái: có nợ thì từ chối deactivate, Party đã tắt thì từ chối tạo nợ.
Audit chỉ phát sau commit, không phát lại cho các attempt bị rollback. Luồng ghi mới phải giữ cơ chế
này; ghi trực tiếp bằng SQL/import riêng không tự được bảo vệ bởi service.

Detail lọc `organizationId` ở cả Party lẫn relation debts và chỉ chọn các cột nợ thuộc contract. Các test opt-in trong
`_test/party-repository.postgres.spec.ts` dùng hai Prisma client trên PostgreSQL riêng với dữ liệu giả,
kiểm tra hai thứ tự tạo nợ/deactivate, hai PATCH đồng thời, việc từ chối liên kết nợ sai tenant và kết quả
repository khi list bằng Prisma hoặc sort theo số dư.

Các giới hạn còn lại:

| Điểm                                  | Tác động / hướng xử lý                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Detail trả toàn bộ debts              | Lịch sử lớn chưa được phân trang; thay đổi cần quyết định API riêng          |
| SQL là raw template                   | Bind tham số không kiểm tra tên cột khi compile; cần test SQL liên quan      |
| Detail có ba điểm cần đối chiếu khi đổi field nợ | Kiểm tra `PARTY_DETAIL_DEBT_SELECT`, `PartyDebt` và `DebtRecordDto` dùng cho Swagger để giữ projection, dữ liệu thực và schema API khớp nhau |
| Audit xử lý sau commit trong cùng process | Nếu có yêu cầu giao nhận bền vững, cần thiết kế cơ chế lưu sự kiện theo transaction |

Các test mock và checker hỗ trợ xác minh phạm vi truy vấn, quy tắc và ranh giới import. Kiểm chứng concurrency thực tế cần các suite PostgreSQL riêng.

## Đối chiếu với dự án và tài liệu tham chiếu

- `CustomerResolver` của Vendure nhận context và quyền rồi giao việc cho `CustomerService`. Danh sách áp scope tại query. Vendure truyền transaction qua `RequestContext` và event bus có cơ chế chờ commit cho subscriber thông thường. DebtFlow áp dụng cùng nguyên tắc về trách nhiệm bằng REST, `PartyWriteStore` và audit sau khi `$transaction` hoàn tất. [Mã nguồn Vendure đã đối chiếu](../../guides/backend-rules/vendure-source-map.md) · [Vendure API Layer](https://docs.vendure.io/current/framework/developer-guide/the-api-layer)
- Application sở hữu hợp đồng mà Prisma adapter triển khai. Nest nối chúng bằng `useClass` và `useFactory` tại `parties.module.ts`. Cách tổ chức này giữ business logic độc lập với ORM và phù hợp với modular monolith hiện tại. [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers) · [Microsoft về Clean Architecture](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures#clean-architecture)
- Khi mở rộng, giữ một service theo feature khi các thao tác cùng sở hữu quy tắc và dữ liệu. Tách use case hoặc adapter khi xuất hiện trách nhiệm độc lập, chẳng hạn luồng xử lý riêng hay yêu cầu triển khai riêng. Với danh sách và audit lớn, đánh giá chi phí query và bảo đảm giao nhận trước khi đổi kiến trúc. [Vendure Service Layer](https://docs.vendure.io/current/framework/developer-guide/the-service-layer)
