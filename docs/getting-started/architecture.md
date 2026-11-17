# Kiến trúc backend

DebtFlow là một NestJS REST API, dùng Prisma và PostgreSQL. Code được chia theo **nghiệp vụ** trong
`src/modules/<feature>/`. Mỗi module có một owner; service phối hợp nghiệp vụ, adapter thực thi DB.
Nền tảng hosting PostgreSQL không quyết định cách chia module.

## Dự án đang dùng kiến trúc gì?

**Modular Monolith, áp dụng Clean Architecture từng module.** Các feature chạy trong cùng ứng dụng.
Party đã tách **Presentation, Application, Domain và Infrastructure**; Domain/Application độc lập
Nest và Prisma. Các module khác chưa được chuyển đồng loạt sang mức độc lập này.

| Trang                                                                   | Nội dung cần đọc                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Clean Architecture của DebtFlow](./architecture/clean-architecture.md) | Các layer, chiều phụ thuộc, lý do lựa chọn và phạm vi đã áp dụng          |
| [Luồng request từ FE đến DB](./architecture/request-flow.md)            | Thứ tự xử lý HTTP, nơi truy cập DB, response và lỗi                       |
| [Ví dụ thực tế: Party](./architecture/party-architecture.md)            | Từng file, method, transaction và trách nhiệm mỗi layer trong module thật |

Đọc theo thứ tự trên. Sơ đồ chiều phụ thuộc giải thích code được import gì; sequence diagram Party
cho biết request thực sự gọi thành phần nào. Repository contract không phải một bước query DB riêng.

## Code nằm ở đâu?

```text
src/
  modules/<feature>/   # HTTP, use case và persistence do feature sở hữu
  auth/               # JWT, current user, global guards và role metadata
  common/             # validation, list query, response/error handling, i18n, Swagger
  database/           # Prisma client dùng chung, lifecycle và transaction infrastructure
  config/             # cấu hình môi trường
  generated/          # code sinh tự động; sửa source/generator rồi generate
```

Trong feature chưa chuyển Clean Architecture, các file thông thường ở gốc khi chỉ có một file cùng trách nhiệm.
Party dùng các thư mục layer rõ ràng như trang Clean Architecture mô tả.
Giữ `dto/`, `_test/`, `repositories/`, `infrastructure/` làm ranh giới rõ ràng.
Không tạo sẵn `services/`, `rules/`, `queries/` nếu chưa có nhiều file cần nhóm.
Xem [Project structure](../development/source/project-structure.md) khi cần quy tắc đặt file chi tiết.

## Những phần dùng chung

- **Auth:** global guards xác thực token và quyền hiện tại. Tenant/actor lấy từ authenticated context.
- **Validation:** DTO và bộ list-query chung kiểm tra input trước khi gọi handler.
- **Response:** controller mapper chọn dữ liệu trả ra; interceptor tạo envelope. Swagger mô tả contract.
- **Persistence:** một Prisma provider cho mỗi app instance; adapter tái sử dụng provider, không tạo client trong từng request.
- **Giao tiếp giữa feature:** dùng public provider contract + module của owner. DTO/type có thể import từ owner theo quy tắc dự án.

`common/`, `database/`, `config/` không phụ thuộc ngược vào feature. Controller/service không gọi
HTTP ngược vào ứng dụng này để tái sử dụng nghiệp vụ.

## Cách đọc tiếp

1. [Hiểu Clean Architecture và lý do lựa chọn](./architecture/clean-architecture.md).
2. [Xem sơ đồ một request từ FE đến DB](./architecture/request-flow.md).
3. [Lần theo ví dụ Party trong source](./architecture/party-architecture.md).
4. [Sửa chức năng hoặc thêm module mới](./module-development.md).

Quy tắc bắt buộc: [Backend Rules](../guides/backend-rules/index.md).
Chi tiết transaction và dependency: [Persistence architecture](../development/persistence/persistence-architecture.md).
