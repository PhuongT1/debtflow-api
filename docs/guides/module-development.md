# Sửa chức năng và thêm module

Đọc [kiến trúc](../02-architecture.md) và [request flow](./request-flow.md) trước.
Dùng [Party](./party-architecture.md) để tìm ví dụ đang chạy; chỉ lấy phần phù hợp với task.

## Sửa chức năng đang có {#maintain-existing-feature}

| Yêu cầu | Sửa ở đâu trước? | Các phần phải đi cùng |
| --- | --- | --- |
| Thêm/sửa route, quyền, status | Controller | Route constants khi cần, Swagger và HTTP contract |
| Thêm field request | Request DTO | Mapper writable fields, service checks, null/omission semantics |
| Thêm field response | Projection + mapper | Response DTO/Swagger, kiểm tra không lộ field nội bộ |
| Thêm filter/sort | Resource `*.list-query.ts` | Query builder; SQL adapter nếu computed sort dùng nó |
| Thêm quyết định nghiệp vụ | Service hoặc rule thuần của feature | Related-ID/tenant checks và failure path |
| Thêm cách đọc/ghi DB | Repository contract → Prisma adapter | DI binding, projection, transaction phù hợp |
| Sửa normalization/serialization | Mapper | Tiền, ngày, null và omitted fields |

Bắt đầu từ route → service → repository binding → adapter. Search helper/type/callers hiện có trước
khi tạo thêm. Không đổi cấu trúc module khác chỉ để hoàn thành một endpoint.

## Thêm module mới

### 1. Xác định owner và API contract

Trước hết kiểm tra chức năng có thuộc feature hiện tại hay không. Module mới cần một ranh giới
nghiệp vụ thực tế, không phải chỉ vì có thêm route public, webhook hoặc worker.
Xác định input, response, role, tenant, trạng thái và related IDs; không lấy actor/role/tenant từ body.

### 2. Chỉ tạo các file cần thiết

Ví dụ tên feature mới là `tasks`; đây là cấu trúc minh họa, không phải code đã tồn tại:

```text
tasks/
  tasks.module.ts
  tasks.controller.ts
  tasks.service.ts
  task.mapper.ts                  # khi thực sự cần mapping dùng chung
  task.types.ts                   # khi cần đặt tên cho contract/type dùng lại
  dto/
    create-task.dto.ts
    task-response.dto.ts
  repositories/
    tasks.repository.ts
  infrastructure/
    prisma-tasks.repository.ts
  _test/
    tasks.service.spec.ts
```

Không tạo CRUD đầy đủ nếu use case chỉ đọc. Không tạo folder rỗng, base service hoặc interface cho
mỗi hàm. Một file query thông thường ở gốc; nhóm `queries/` khi có nhiều file. Với nhiều SQL builder
riêng, dùng `infrastructure/sql/`. Tests luôn ở `_test/` của owner.
Controller/module có khoảng hai dòng đầu mô tả chức năng thực tế.

### 3. Nối module và dependency injection

Trong feature module, bind contract với adapter:

```ts
providers: [
  TasksService,
  { provide: TasksRepository, useClass: PrismaTasksRepository },
]
```

Đăng ký controller, import provider/module cần dùng, rồi import feature module vào `AppModule`.
Service inject `TasksRepository`; không inject `PrismaTasksRepository` hoặc `PrismaService`.
Nếu feature khác cần provider, export có chủ đích qua owning module và named public contract.
Không tạo forwarding barrel chỉ để re-export một DTO/type.

### 4. Tái sử dụng đúng contract

- Dữ liệu DB: dùng generated Prisma types, projection `satisfies Prisma.*Select` và `Prisma.*GetPayload`
  hoặc kiểu suy ra từ hàm. Không khai báo lại các trường model bằng tay.
- Request: dùng DTO class để giữ runtime validation. Dùng `PartialType`/`PickType`/`OmitType` của Nest
  khi có cùng semantics; type `Partial<T>` không tạo validator.
- Response: mapper thực hiện chuyển đổi; Swagger DTO mô tả contract. Prisma record không tự trở thành
  response an toàn. Tiền dùng Decimal khi tính và string khi serialize.
- Sort/filter: dùng bộ `common/query`; không tạo hàm sort ngày/chuỗi riêng ở mỗi feature.
- Writes phụ thuộc nhau: adapter giữ cùng transaction; service quyết định nghiệp vụ, audit phát sau
  commit. Kiểm tra rồi ghi ở hai bước không tự bảo đảm an toàn khi có request đồng thời.

### 5. Kiểm tra đúng phần ảnh hưởng và cập nhật docs

Chạy test tại owner của hành vi thay đổi: validation, tenant/role, rule, mapper hoặc query. Chọn
check kiến trúc/type/lint/build theo phạm vi trong [testing rules](./backend-rules/testing-completion.md).
Không mặc định chạy full suite hoặc DB/load test; cần nêu scope và được đồng ý trước.

Đổi API/schema thì regenerate reference từ source. Đổi quy trình/kiến trúc thì cập nhật guide tương
ứng. `AGENTS.md` và [Backend Rules](./backend-rules/index.md) là nguồn policy; không tạo một bộ rule
mới trong README của mỗi module.

## Khi không biết sửa ở đâu

Dùng bảng đầu trang và mở module tương tự. Giữ service cho use case, adapter cho DB, mapper cho
chuyển đổi. Nếu phải import private implementation của feature khác hoặc tạo thêm tầng chỉ để hết
lỗi import, kiểm tra lại owner và dependency trước khi tiếp tục.
