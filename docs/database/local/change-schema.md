# Dev: tạo migration khi thêm hoặc sửa model

**Dùng khi:** bạn thay đổi `prisma/models/` trên DB development riêng.
Trang này chỉ tạo và kiểm tra migration ở dev; phát hành theo [quy trình production](../../deployment/environments/production.md).

## 1. Xác nhận đang dùng DB dev

Chạy Terminal tại root repository. `.env` phải trỏ DB dev riêng; không để URL staging/production
trong biến shell vì CLI có thể ưu tiên biến đã được cấp. Xem [kết nối](../configure-connection.md).
`NODE_ENV=development` không phải cơ chế bảo đảm lệnh Prisma chọn đúng DB.

Ví dụ hướng dẫn: thêm `website String?` vào model `Party`. Đây không phải thay đổi được áp dụng
vào source hiện tại.

## 2. Sinh SQL để review

Sau khi sửa model:

```bash
# Validate the changed Prisma models without accessing application data.
npm run db:validate
# Create a draft migration on the private development database.
npm run db:migrate:dev -- --name add_party_website --create-only
```

**Kết quả:** có thư mục `prisma/migrations/<timestamp>_add_party_website/` chứa `migration.sql`.
Mở SQL trước khi apply. Với ví dụ này, SQL phải thêm cột nullable, không DROP cột/bảng cũ.
`--create-only` vẫn cần kết nối dev/shadow DB và có thể phát hiện drift; không đồng ý reset khi chưa hiểu dữ liệu.

## 3. Apply vào dev và cập nhật client

```bash
# Apply the reviewed migration to the private development database.
npm run db:migrate:dev
# Generate Prisma types and metadata for the changed schema.
npm run db:generate
# Check local migration history against this checkout.
npx prisma migrate status
```

**Kết quả:** migration mới được áp dụng; status báo `Database schema is up to date!`.
Prisma 7 không tự generate/seed trong bước migrate dev, nên generate là lệnh riêng.

Cập nhật DTO, projection, mapper và API liên quan nếu field cần được nhận/trả; field trong DB không
tự trở thành field công khai trên API. Chạy typecheck/build và test đúng phần ảnh hưởng theo policy.

## 4. Chuẩn bị bàn giao release

Commit model, migration mới, code/test và reference cần cập nhật trong cùng thay đổi có liên quan.
Không commit env thật, client generated hoặc `dist/`. Không sửa/đổi tên migration đã chia sẻ hoặc apply.

Đồng đội nhận code chạy [cập nhật DB dev](./index.md), không sinh lại migration cho cùng thay đổi.

Sau đó làm theo [staging](../../deployment/environments/staging.md) rồi
[production: code và DB từng bước](../../deployment/environments/production.md).
Không chạy migrate dev trên staging/production. Với đổi/xóa field hoặc bảng, đọc
[thứ tự code và DB](../../deployment/environments/schema-changes.md) trước khi thiết kế migration.

Nguồn: [Prisma CLI v7 — migrate dev](https://docs.prisma.io/docs/cli/v7/migrate/dev),
[review/customize migration](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations).
