# Migration: thứ tự chạy và kiểm tra

Trang con của [DB trống: tạo toàn bộ bảng](./initialize-empty.md).
Dùng cùng quy trình cho DB trống và DB đã nhận một phần migration.

## 1. Một lệnh sẽ chạy những gì?

```bash
# Apply pending migrations to staging, in migration-directory order.
npm run db:deploy:staging
```

Prisma đọc `prisma/migrations/` trong bản code đang checkout, đối chiếu với bảng
`_prisma_migrations` của DB đích, rồi chạy các migration chưa áp dụng **theo thứ tự tên
thư mục tăng dần**. Tiền tố thời gian giúp sắp xếp thứ tự; không phải lịch hẹn chạy.

- **DB trống:** chạy từ migration đầu đến cuối.
- **DB đã chạy 8 migration đầu:** bình thường chỉ chạy migration 9 và 10.
- **Chạy lại khi không có migration mới:** không chạy lại các file đã áp dụng thành công.
- **Migration bị lỗi:** dừng và xử lý theo [migration lỗi](./migration-failure.md);
  không bỏ qua lỗi rồi chạy tay file kế tiếp.

Trong mỗi thư mục, `migration.sql` chứa SQL được thực thi theo thứ tự câu lệnh trong file.
`migration_lock.toml` ghi provider của lịch sử migration, không phải file SQL để chạy.
Prisma không tự tạo SQL từ model mới trong lệnh deploy: thay đổi model phải có migration đã commit.

## 2. Thứ tự và tác dụng các migration hiện tại

Đây là 10 migration hiện có trong repository, không phải danh sách cố định cho các release sau.
Khi thêm migration, cập nhật bảng này theo SQL thực tế; không đổi tên lịch sử đã áp dụng.

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

## 3. Trước khi chạy: biết file nào còn thiếu

Xác nhận `.env.staging` trỏ đúng DB và checkout đúng bản code cần phát hành.

```bash
# Show applied/pending migration history without applying migration SQL.
npm run db:status:staging
```

CLI so sánh thư mục migration với lịch sử DB và liệt kê migration chưa áp dụng.
DB trống hoặc còn migration pending có thể trả exit code 1; đọc thông báo để phân biệt pending
với lỗi kết nối/lịch sử. Không coi mọi exit code 1 trước deploy là lỗi SQL.

Đọc SQL của các migration pending trước khi apply. Với DB có dữ liệu, chuẩn bị backup/restore
và kiểm tra thay đổi trên staging trước production. Không sửa file cũ để ép status thành công.

## 4. Sau khi chạy: kiểm tra đúng hay sai

```bash
# Apply pending staging migrations; continue only if the command succeeds.
npm run db:deploy:staging
# Verify that staging has no pending or failed migrations.
npm run db:status:staging
```

1. Deploy kết thúc thành công; status báo `Database schema is up to date!`.
2. Trong DBeaver, mở **connection staging**, refresh schema `public` → Tables.
3. Mở SQL Editor của connection đó, chạy câu SELECT dưới đây để xem lịch sử:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
FROM public._prisma_migrations
ORDER BY migration_name, started_at;
```

Một lần áp dụng thành công có `finished_at` khác NULL và `rolled_back_at` là NULL.
Sau khôi phục lỗi có thể còn bản ghi thất bại cũ; đối chiếu với kết quả `migrate status`,
không chỉ đếm số dòng và kết luận mỗi migration phải có đúng một dòng.

Status đúng nghĩa là **lịch sử migration đã khớp**; chưa chứng minh toàn bộ API đúng hoặc DB không
bị chỉnh tay ngoài migration. Kiểm tra bảng/cột/index vừa đổi trong DBeaver và gọi các API bị ảnh hưởng
trên staging. Nếu phát hiện DB lệch hoặc migration lỗi, theo [hướng dẫn xử lý](./migration-failure.md).
Không có bước tự rollback toàn bộ chuỗi migration khi một file thất bại; các file trước có thể đã áp dụng.

## 5. Đưa cùng thay đổi lên production

Sau khi kiểm tra staging, dùng **cùng bộ file migration đã commit**:

```bash
# Inspect production migration history using .env.production.
npm run db:status:production
# Apply pending migrations only after confirming the production target and release approval.
npm run db:deploy:production
# Verify production migration history after a successful deploy.
npm run db:status:production
```

Mỗi DB có bảng `_prisma_migrations` riêng. Staging đã chạy không có nghĩa production đã chạy.
Không copy bảng lịch sử từ staging sang production, không chạy seed demo để kiểm tra migration.

Nguồn: [Prisma 7 — migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy),
[migrate status](https://www.prisma.io/docs/cli/v7/migrate/status) và
[migration histories](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories).
