# Database — chọn tình huống cần làm

Tài liệu dùng PostgreSQL và Prisma 7 của repository. Mỗi trang xử lý một việc;
chỉ đọc trang khớp với database và thay đổi của bạn.

| Bạn đang cần làm gì? | Mở hướng dẫn |
| --- | --- |
| Chưa có database hoặc chưa biết đặt URL | [Tạo DB và cấu hình kết nối](./configure-connection.md) |
| DB staging/production trống, cần đủ bảng và field như dev | [Khởi tạo toàn bộ schema](./initialize-empty.md) |
| Muốn biết file SQL nào chạy trước, đã chạy hay còn thiếu | [Thứ tự migration và kiểm tra kết quả](./migration-order.md) |
| Dev thêm bảng/field, staging/production cần có thay đổi đó | [Phát hành bảng hoặc field mới](./add-tables-fields.md) |
| Đổi tên/kiểu, xóa field hoặc thêm field bắt buộc | [Thay đổi field đang có dữ liệu](./change-existing-fields.md) |
| Dev mới join hoặc vừa nhận migration từ đồng đội | [Cập nhật DB development](./new-developer.md) |
| Cần dữ liệu demo, account QA hoặc backfill | [Chuẩn bị và chuyển dữ liệu](./data-changes.md) |
| DB đã có bảng nhưng thiếu lịch sử Prisma | [Đối chiếu và baseline DB có sẵn](./existing-database.md) |
| Migration lỗi, báo drift hoặc yêu cầu reset | [Xử lý migration lỗi](./migration-failure.md) |
| Cần kiểm tra index/SQL của Party | [Party indexes và DB tests](./party-indexes.md) |

## Ba điều cần nhớ

- **Schema:** dev tạo migration SQL → commit → staging apply → kiểm tra → production apply cùng migration.
- **Dữ liệu:** mỗi môi trường giữ dữ liệu riêng; migration không tự copy toàn bộ DB dev.
- **Lệnh:** `db:migrate` tạo migration ở dev; `db:deploy` apply migration đã commit.

Vercel build hiện không chạy migration; chưa có job release tự động trong repo.
Không dùng `setup:dev`, seed demo hoặc reset cho staging/production.

Các quy trình được đối chiếu với [Prisma 7 — development và production](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)
và các file cấu hình/lệnh hiện tại của repo. Khi thêm tình huống mới, tạo một trang con tương ứng
và thêm vào mục lục/sidebar; không ghép lại thành một bài dài.
