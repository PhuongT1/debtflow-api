# Có cần chuyển dữ liệu từ dev sang staging/production không?

**Dùng khi:** cần account QA, danh mục ban đầu hoặc dữ liệu cho field mới.
**Kết quả:** chọn đúng cách đưa dữ liệu vào DB, không nhầm với migration schema.

## Chọn đúng tình huống

| Nhu cầu | Cách làm |
| --- | --- |
| Tạo bảng/field giống dev | Apply migration; xem [DB trống](./initialize-empty.md) hoặc [schema mới](./add-tables-fields.md) |
| Tài khoản/dữ liệu giả cho QA | Fixture/bootstrap riêng đã review, chỉ dữ liệu staging |
| Danh mục nghiệp vụ dùng chung | Migration dữ liệu hoặc bootstrap được review và có thể chạy lại an toàn |
| Điền giá trị field mới từ field cũ | Backfill; xem [đổi field](./change-existing-fields.md) |
| Copy toàn bộ DB sang server mới | Kế hoạch backup/restore hoặc chuyển DB riêng, không phải `migrate deploy` |

## Nếu cần fixture/bootstrap

1. Liệt kê chính xác dữ liệu cần tạo, environment và organization đích.
2. Chọn ID/khóa định danh và hành vi khi bản ghi đã tồn tại; tránh tạo trùng hoặc ghi đè ngoài ý muốn.
3. Review script, quyền thực thi và nơi giữ credentials; không ghi mật khẩu cố định cho production.
4. Chạy trên staging được giao quyền, kiểm tra record, tenant và khả năng đăng nhập nếu có account.
5. Ghi lại kết quả; production chỉ chạy phần dữ liệu ban đầu được duyệt riêng.

Repo có `prisma/seed.ts` cho dữ liệu demo dev; nó không phải bootstrap production.
Hiện chưa có script bootstrap production riêng. Không hướng dẫn dev chạy seed này trên production.

## Nếu cần copy toàn bộ dữ liệu

Xác định nguồn/đích, phiên bản PostgreSQL, dữ liệu nhạy cảm, thời gian dừng ghi và kế hoạch restore.
Thử khôi phục trên DB tách biệt, rồi đối chiếu dữ liệu và `_prisma_migrations` trước khi chuyển API.
Không restore đè vào DB đang phục vụ và không copy dữ liệu dev lên production để “tạo đủ bảng”.
Quy trình chuyển server phụ thuộc hạ tầng, cần kế hoạch riêng khi có nguồn/đích cụ thể.

Nguồn phân biệt schema và dữ liệu: [Prisma 7 — migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy).
