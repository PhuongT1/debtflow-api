# Migration staging: thứ tự chạy và nhận biết kết quả

Trang con của [Áp dụng migration: tạo mới và cập nhật DB](./index.md).
Trang này chỉ hướng dẫn **staging**, từ kiểm tra trước khi chạy đến xác nhận kết quả.
Các output dưới đây là **trích đoạn minh họa**; tên DB, số migration và cách trình bày có thể khác.

Nếu bạn đang phát hành production, dùng [checklist code và DB production](../../deployment/environments/production.md).
Không thay chữ staging trong lệnh rồi bỏ qua các bước kiểm tra tương thích và gate phát hành.

## 1. Chuẩn bị trước khi chạy

Chạy trong Terminal tại root repository, dùng bản code chứa các migration cần áp dụng.
Chuẩn bị `.env.staging` với `DATABASE_URL` và `DIRECT_URL` cùng trỏ đến DB staging mong muốn.
Xem [cấu hình kết nối](../configure-connection.md) nếu chưa có file này.

**Trước bước này:** DB có thể chưa có bảng, hoặc đã áp dụng một phần lịch sử migration.
**Sau bước này:** đã xác định đúng DB đích và đúng bộ file trong `prisma/migrations/` để áp dụng.
Nếu DB đã có dữ liệu, cần có phương án backup/restore trước khi thay đổi schema.

## 2. Kiểm tra trước: migration nào chưa chạy?

```bash
# Inspect staging migration history without applying migration SQL.
npm run db:migrate:status:staging
```

**Nếu còn migration chưa áp dụng**, output sẽ nêu các tên còn thiếu. Ví dụ rút gọn:

```text
10 migrations found in prisma/migrations

Following migration(s) have not yet been applied:
20260920113000_add_party_search_text
20261102100000_optimize_party_list_indexes
```

**Cách đọc:** DB đã nhận các migration trước đó; hai migration được liệt kê còn chờ chạy.
DB trống có thể liệt kê toàn bộ lịch sử hoặc thông báo chưa có lịch sử migration.
Exit code 1 ở bước status có thể chỉ là còn pending/chưa có lịch sử, không tự động có nghĩa SQL bị lỗi.

### Trường hợp đã apply hết migration

Nếu DB đã nhận đủ migration, ví dụ output hoàn chỉnh của bước status sẽ như sau
(đã thay tên DB/host bằng placeholder):

```text
> debtflow-api@0.1.0 db:migrate:status:staging
> node scripts/database/database-migrate.mjs staging status

Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma.
Datasource "db": PostgreSQL database "STAGING_DATABASE", schema "public" at "STAGING_HOST"

10 migrations found in prisma/migrations

Database schema is up to date!
```

**Kết quả:** đã áp dụng hết migration trong checkout này; status kết thúc thành công (exit code 0),
Terminal trở lại dấu nhắc. **Không cần chạy apply thêm**; chuyển đến bước 5 để đối chiếu thay đổi
hoặc tiếp tục kiểm tra API theo kế hoạch phát hành.

**Nếu mới thấy `10 migrations found` như hình:** dòng này chỉ đếm thư mục migration trong source.
Đợi lệnh kết thúc và đọc dòng cuối; chỉ riêng dòng đếm chưa chứng minh DB đã cập nhật xong.
Nếu lệnh vẫn đang chạy mà chưa có kết quả cuối, chưa kết luận thành công.
Nếu output báo lỗi kết nối, failed migration hoặc lịch sử khác nhau, xử lý lỗi đó trước;
xem [migration lỗi hoặc drift](../schema/migration-failure.md).

### Sau bước status, đi tiếp thế nào?

| Dòng kết quả | Việc tiếp theo |
| --- | --- |
| `Database schema is up to date!` | Không cần apply; kiểm tra thay đổi/API liên quan. |
| `Following migration(s) have not yet been applied:` | Review danh sách, xác nhận kế hoạch rồi làm bước 3. |
| DB trống/chưa có bảng lịch sử | Nếu đúng DB mới đã chuẩn bị, làm bước 3 để apply toàn bộ lịch sử. |
| Lỗi kết nối, failed migration hoặc lịch sử không khớp | Dừng; xử lý theo thông báo trước khi apply/deploy. |

## 3. Áp dụng migration: theo dõi đến dòng kết thúc

```bash
# Apply pending migrations to staging in directory-name order.
npm run db:migrate:apply:staging
```

### Bắt đầu chạy

Ví dụ output rút gọn:

```text
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma.
Datasource "db": PostgreSQL database "STAGING_DATABASE", schema "public" at "STAGING_HOST"

10 migrations found in prisma/migrations
```

- `Loaded Prisma config` và `Prisma schema loaded`: mới đọc được cấu hình và model, **chưa phải thành công**.
- `Datasource`: đối chiếu tên DB, host và schema với DB staging đã chuẩn bị.
  Tên script có chữ staging không thay thế việc kiểm tra URL trong `.env.staging`.
- `10 migrations found`: tìm thấy 10 thư mục migration trong source; **không có nghĩa đã chạy xong 10 file**.

### Đang áp dụng từng file

Ví dụ DB còn thiếu hai migration cuối:

```text
Applying migration `20260920113000_add_party_search_text`
Applying migration `20261102100000_optimize_party_list_indexes`
```

**Cách đọc:** Prisma đang thực thi SQL của những migration đó theo thứ tự.
DB trống sẽ bắt đầu từ `20260624061904_init_sales_debt_schema` và đi đến migration cuối.
Đợi đến thông báo kết thúc; không kết luận thành công chỉ từ các dòng `Applying migration`.

### Kết thúc thành công

Output sẽ liệt kê các migration vừa áp dụng, rồi kết thúc bằng:

```text
The following migration(s) have been applied:
...
All migrations have been successfully applied.
```

**Đây là dòng xác nhận thành công trong hình bạn đã chạy.** SQL của các migration pending đã được
áp dụng thành công; Terminal trở lại dấu nhắc để nhập lệnh tiếp theo. Tiếp tục bước 4 để đối chiếu lịch sử.

### Không có migration mới

Nếu vẫn chạy apply khi DB đã nhận đủ migration, ví dụ output là:

```text
> debtflow-api@0.1.0 db:migrate:apply:staging
> node scripts/database/database-migrate.mjs staging apply

Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma.
Datasource "db": PostgreSQL database "STAGING_DATABASE", schema "public" at "STAGING_HOST"

10 migrations found in prisma/migrations

No pending migrations to apply.
```

**Cách đọc:** không có SQL migration mới cần chạy; các migration thành công trước đó không bị chạy lại.
Đây là trạng thái bình thường, không phải lỗi và không phải tạo lại bảng.

### Kết thúc bằng lỗi

Nếu xuất hiện `Error`, mã lỗi hoặc thông báo migration thất bại thay vì thông báo thành công,
**chưa hoàn tất việc cập nhật DB**. Ghi lại tên migration bị lỗi và mở [hướng dẫn xử lý](../schema/migration-failure.md).
Các file trước có thể đã áp dụng; không mặc định toàn bộ chuỗi sẽ tự rollback, không chạy tay file sau
và không reset DB để bỏ qua lỗi.

## 4. Kiểm tra sau: xác nhận không còn migration thiếu

Chạy sau khi apply báo thành công hoặc `No pending migrations to apply.`.
Nếu bước 2 đã báo up to date và không chạy apply, không cần lặp lại status:

```bash
# Confirm staging has no pending or failed migrations.
npm run db:migrate:status:staging
```

**Kết quả mong đợi:**

```text
10 migrations found in prisma/migrations

Database schema is up to date!
```

**Cách đọc:** lịch sử DB đã khớp các migration hiện tại. Nếu vẫn báo pending, failed hoặc khác lịch sử,
chưa xác nhận hoàn tất; kiểm tra đúng DB, đúng checkout và thông báo lỗi.

Status kiểm tra lịch sử migration, không chứng minh mọi API đúng hoặc DB chưa từng bị sửa tay.
Với thay đổi vừa áp dụng, kiểm tra thêm bảng/cột/index tương ứng và API bị ảnh hưởng trên staging.

## 5. Đối chiếu trong DBeaver

Mở đúng connection staging → schema `public` → refresh `Tables`.
DB vừa khởi tạo sẽ có các bảng như `User`, `Organization`, `Party`, `Debt` và `_prisma_migrations`.

Trong **SQL Editor** của connection đó, chạy:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM public._prisma_migrations
ORDER BY migration_name, started_at;
```

**Ví dụ một dòng thành công:**

| migration_name | started_at | finished_at | rolled_back_at |
| --- | --- | --- | --- |
| `20261102100000_optimize_party_list_indexes` | Có thời điểm bắt đầu | Có thời điểm hoàn tất | `NULL` |

Một lần áp dụng thành công có `finished_at` khác NULL và `rolled_back_at` là NULL.
Sau khôi phục lỗi có thể còn bản ghi thất bại cũ; đối chiếu với `migrate status`, không chỉ đếm dòng.

## 6. Lệnh apply chạy những file nào, theo thứ tự nào?

Prisma đọc `prisma/migrations/`, đối chiếu `_prisma_migrations` của DB staging, rồi thực thi các
migration chưa áp dụng theo **tên thư mục tăng dần**. Tiền tố thời gian để sắp xếp, không phải lịch hẹn.
Trong mỗi thư mục, `migration.sql` chứa các câu SQL theo thứ tự thực thi; `migration_lock.toml`
ghi provider của lịch sử, không phải SQL để chạy.

Đây là 10 migration hiện có. Khi thêm migration, cập nhật bảng theo SQL thực tế;
không đổi tên hoặc chỉnh sửa migration đã áp dụng.

| Thứ tự | Thư mục | SQL làm gì? |
| --- | --- | --- |
| 1 | `20260624061904_init_sales_debt_schema` | Tạo enum, các bảng ban đầu như User, Party, Debt, Payment và các khóa/index ban đầu. |
| 2 | `20260624072000_add_user_phone_for_login` | Thêm User.phone và unique index. |
| 3 | `20260807094345_20260807_add_address` | Thêm Party.address2. |
| 4 | `20260817083856_add_field_ul` | Thêm cột Party.urlImages của phiên bản cũ. |
| 5 | `20260817084947_add_field_ul2` | Xóa urlImages và thêm imageUrl; không copy dữ liệu giữa hai cột. |
| 6 | `20260903062847_add_catalog_and_debt_items` | Thêm catalog Category/Brand/Product, DebtItem, sales channel và các field liên quan. |
| 7 | `20260903113000_add_payment_allocations` | Tạo PaymentAllocation, chuyển payment cũ thành voucher có allocation, thay quan hệ Payment–Debt. |
| 8 | `20260904140000_add_organizations_and_tenant_isolation` | Tạo Organization/Membership, chuyển dữ liệu cũ vào workspace legacy, bổ sung tenant và ràng buộc liên quan. |
| 9 | `20260920113000_add_party_search_text` | Bật unaccent, thêm và điền searchText cho Party, tạo index. |
| 10 | `20261102100000_optimize_party_list_indexes` | Thêm index Party/Debt và pg_trgm phục vụ lọc/tìm kiếm. |

Vì file sau có thể sửa cấu trúc do file trước tạo ra, **không chọn chỉ chạy file cuối** trên DB trống.
Ví dụ migration 4 tạo urlImages, migration 5 thay bằng imageUrl: trạng thái cuối có imageUrl.
Migration 7 và 8 còn chuyển dữ liệu có sẵn; migration không chỉ chứa CREATE TABLE.
DB đích cần cho phép các extension `unaccent`, `pg_trgm` được yêu cầu trong SQL.


Lệnh apply không tự sinh SQL từ thay đổi model chưa có migration, không copy toàn bộ dữ liệu dev
và không chạy seed demo. Khi status đã khớp và phần thay đổi đã được kiểm tra trên staging,
bạn đã hoàn tất quy trình của trang này.

Nguồn: [Prisma 7 — migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy),
[migrate status](https://www.prisma.io/docs/cli/v7/migrate/status) và
[migration histories](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories).
