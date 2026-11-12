# Dev mới hoặc vừa nhận migration của đồng đội

**Dùng khi:** cần cập nhật DB development riêng theo migration đã có trong Git.
**Kết quả:** DB local/dev có các bảng và field cùng lịch sử migration của bản code đang dùng.

## 1. Chuẩn bị DB dev riêng

Làm theo [tạo database và cấu hình URL](./configure-connection.md).
Không dùng DB staging/production hoặc DB chung của đồng đội để thử thay đổi.

## 2. Apply migration đã có

Tại root repository, với `.env` trỏ đúng DB dev:

```bash
# Use the Node.js version specified in this project’s .nvmrc.
nvm use
# Install the exact dependencies in package-lock.json; replace existing node_modules.
npm ci
# Apply committed migrations to the configured database.
npm run db:deploy
# Generate Prisma client/types from the schema; do not migrate the database.
npm run db:generate
# Compare local migration history with the configured database.
npx prisma migrate status
```

Dùng cùng các lệnh khi DB dev đang trống hoặc thiếu migration mới từ đồng đội.
Không cần tạo migration khác để “đồng bộ” lại thay đổi đã commit.

## 3. Dữ liệu demo và chạy BE

Nếu DB dev này được phép ghi dữ liệu giả, có thể chạy:

```bash
# Write demo records to the authorized development database.
npm run db:seed
# Start the API in watch mode; restart when source files change.
npm run dev
```

Seed hiện tại tạo/cập nhật dữ liệu demo và có thể đặt lại mật khẩu tài khoản demo.
`setup:dev` cũng chạy seed; chỉ dùng trên DB development được phép.
Mở `/docs` theo địa chỉ log lúc khởi động; đăng nhập và kiểm tra API cần dùng.

## Khi bắt đầu tự sửa model

Chuyển sang [tạo migration cho bảng/field mới](./add-tables-fields.md).
`migrate dev` cần shadow DB để kiểm tra lịch sử. Nếu thiếu quyền tạo DB,
nhờ maintainer cấu hình shadow DB riêng; repo chưa khai báo shadow URL riêng.
Không dùng staging/production làm shadow DB.

Nếu đổi nhánh rồi CLI báo drift/reset, đọc [migration lỗi](./migration-failure.md),
không đồng ý reset DB có dữ liệu cần giữ.

Nguồn: [Prisma 7 — shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).
