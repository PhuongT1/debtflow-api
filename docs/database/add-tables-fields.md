# Dev thêm bảng hoặc field: đưa thay đổi lên staging/production

**Dùng khi:** có thay đổi schema mới; staging/production đã có lịch sử migration của repo.
**Ví dụ:** thêm field `website String?` vào model `Party`.

## 1. Tạo migration trên DB dev riêng

Sửa model trong `prisma/models/`, rồi chạy tại root repository với `.env` dev đúng:

```bash
# Validate Prisma schema syntax without applying migrations.
npm run db:validate
# Generate migration SQL for review without applying the new migration.
npm run db:migrate -- --name add_party_website --create-only
```

Mở `prisma/migrations/<timestamp>_add_party_website/migration.sql` để review.
Trong ví dụ này, mong đợi SQL thêm cột nullable `website`, không xóa bảng hoặc cột cũ.
Đây là ví dụ hướng dẫn, không phải yêu cầu thêm field vào source hiện tại.

## 2. Apply và kiểm tra trên dev

```bash
# Create/apply migrations on the private development database.
npm run db:migrate
# Generate Prisma client/types from the schema; do not migrate the database.
npm run db:generate
# Generate and compile the production artifact; do not apply migrations.
npm run build
```

Kiểm tra API bị ảnh hưởng. Nếu field cần nhận/trả qua API, cập nhật DTO, projection, mapper
và Swagger tương ứng; thêm field trong DB không tự mở field đó trên API.

Commit cùng nhau: model, thư mục migration mới, code và test liên quan.
Không commit generated client, `.env` hoặc `dist/`. Không sửa migration đã apply/chia sẻ.

## 3. Apply cùng migration lên staging

Chọn bản code đã commit. Với [file env staging đã chuẩn bị](./configure-connection.md):

```bash
# Apply pending staging migrations; inspect status only after success.
npm run db:deploy:staging && npm run db:status:staging
```

Xem [thứ tự migration và cách đối chiếu lịch sử](./migration-order.md).
Prisma chỉ apply migration còn thiếu; không tạo lại các bảng đã có migration thành công.
Deploy API tương ứng và kiểm tra field/bảng mới bằng DBeaver cùng API liên quan.

## 4. Apply lên production

Kiểm tra backup và khả năng chạy chung với bản API đang phục vụ. Dùng cùng commit/migration đã
qua staging. Với `.env.production` đã điền cả hai URL production:

```bash
# Apply the same migrations to production and check status after success.
npm run db:deploy:production && npm run db:status:production
```

Job CI/CD đã inject secrets đúng môi trường có thể dùng `npm run db:deploy` trực tiếp.
Chỉ deploy/promote API sau khi migration thành công; dừng release khi thất bại.

**Kết quả:** các DB có cùng thay đổi schema, dữ liệu nghiệp vụ của mỗi môi trường vẫn riêng.
Nếu thêm field bắt buộc, đổi kiểu/đổi tên hoặc xóa field, dùng [quy trình thay đổi dữ liệu hiện có](./change-existing-fields.md).

Nguồn: [Prisma 7 — development và production](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production).
