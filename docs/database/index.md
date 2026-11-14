# Database: dev local và staging/production

Chọn theo môi trường bạn đang thao tác. **Dev tạo migration; staging/production áp dụng migration đã
review.** Cùng lịch sử schema, nhưng mỗi DB có dữ liệu và credentials riêng.

## 1. Làm việc trên DB dev riêng

| Bạn cần làm gì? | Hướng dẫn |
| --- | --- |
| Mới clone, DB dev trống hoặc nhận migration của đồng đội | [Cài và cập nhật DB dev](./local/index.md) |
| Tự thêm/sửa model, tạo SQL migration mới | [Tạo migration ở dev](./local/change-schema.md) |
| Chưa có URL hoặc chưa biết chọn DB nào | [Kết nối và môi trường](./configure-connection.md) |

DB dev có thể là PostgreSQL trên máy hoặc DB development riêng trên dịch vụ hosting.
“Chạy local” nói nơi chạy code, không bắt buộc PostgreSQL cũng nằm cùng máy.

## 2. Chuẩn bị DB staging/production

| Bạn cần làm gì? | Hướng dẫn |
| --- | --- |
| Hiểu chuyển gì từ dev và ai chạy migration | [Chuẩn bị DB để phát hành](./releases/index.md) |
| Đặt URL trên Vercel/host và release runner | [Kết nối runtime và runner](./releases/connect-runtime.md) |
| DB trống hoặc đã có lịch sử, cần áp dụng migration còn thiếu | [Tạo mới và cập nhật schema](./migrations/index.md) |
| Xem thứ tự SQL và nhận biết thành công/thất bại | [Migration trên staging](./migrations/order.md) |
| Cần account để login/kiểm thử | [Tạo user](./users/create-user.md), [kiểm tra quyền](./users/verify-user-access.md) |

## 3. Phát hành code và DB cùng nhau

Đọc **[production từng bước](../deployment/environments/production.md)** để đi từ dev/staging →
chuẩn bị release runner → kiểm tra pending → apply SQL → deploy code → kiểm tra sau deploy.

[Trang tình huống schema](../deployment/environments/schema-changes.md) phân biệt code-only,
thêm bảng/cột, field bắt buộc, rename/đổi kiểu, DROP và backfill. Không dùng một thứ tự migrate/deploy
cho tất cả trường hợp.

## 4. Tra cứu khi cần

- [Thay đổi dữ liệu hiện có](./schema/change-existing-fields.md) và [backfill](./data-changes.md).
- [Migration lỗi/drift](./schema/migration-failure.md), [DB có sẵn cần baseline](./schema/existing-database.md).
- [Schema tổng quan](./overview.md), [Party indexes và DB tests](./party-indexes.md).

Không copy DB dev lên production; không dùng reset/seed demo để cập nhật DB vận hành.
Vercel build và API startup hiện không tự migrate. Các lệnh đã có trong `package.json` và dùng
[Prisma CLI v7](https://docs.prisma.io/docs/cli/v7/migrate/deploy).
