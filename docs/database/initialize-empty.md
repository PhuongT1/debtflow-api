# DB trống: chạy lệnh nào để tạo tất cả bảng?

**Có PostgreSQL staging nhưng chưa có bảng nào? Lệnh tạo bảng là:**

```bash
# Load staging settings and apply all pending committed migrations.
npm run db:deploy:staging
```

Chạy trong **Terminal tại thư mục `debtflow-api`**, không chạy trong DBeaver.
Lệnh đọc URL từ `.env.staging`, rồi chạy các file SQL trong `prisma/migrations/`
để tạo toàn bộ bảng, field, khóa và index của bản code hiện tại.

Nếu chưa chuẩn bị file env và dependencies, thực hiện lần lượt dưới đây.

## Bước 1 — mở Terminal tại thư mục dự án

```bash
# Open a terminal in the project root.
cd /Users/phuong/Documents/Projects/debtflow-api
# Use the Node.js version specified in this project’s .nvmrc.
nvm use
# Install the exact dependencies in package-lock.json; replace existing node_modules.
npm ci
```

Đường dẫn trên là source local hiện tại; máy khác thay bằng đường dẫn checkout của mình.
Dùng bản code chứa đầy đủ migration sẽ triển khai.

## Bước 2 — tạo file kết nối staging

Nếu chưa có `.env.staging`, chạy:

```bash
# Create staging settings from the template; skip if the file exists.
cp .env.example .env.staging
```

Mở `.env.staging` trong editor, điền **cả hai URL của DB staging**:

```env
DATABASE_URL="postgresql://USER:PASSWORD@STAGING_HOST:5432/STAGING_DATABASE?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@STAGING_HOST:5432/STAGING_DATABASE?sslmode=require"
```

Thay placeholder bằng kết nối thật do nhà cung cấp cấp, giữ TLS/options của họ.
Nếu ứng dụng dùng pooler, `DATABASE_URL` là URL pooler, `DIRECT_URL` là URL trực tiếp tới cùng DB.
Lệnh tạo bảng không cần JWT secret. Không sửa `.env` development hoặc commit file chứa URL thật.

## Bước 3 — chạy lệnh tạo toàn bộ bảng

```bash
# Apply pending migrations using .env.staging.
npm run db:deploy:staging
```

Script đọc `DATABASE_URL` và `DIRECT_URL` trực tiếp từ `.env.staging`, thay thế URL có sẵn
trong shell. Thiếu file hoặc thiếu một trong hai biến thì dừng trước khi gọi Prisma.
Không lấy URL còn thiếu từ `.env` development.

Xem trang con [Migration: thứ tự chạy và kiểm tra](./migration-order.md) để biết từng file SQL
làm gì, file nào sẽ chạy và cách đối chiếu kết quả.

**Không cần chạy từng câu CREATE TABLE, không export bảng từ dev, không tạo migration init mới.**
Nếu model có thay đổi chưa được tạo migration, lệnh này chưa thể đưa thay đổi đó vào DB.

## Bước 4 — kiểm tra đã tạo xong

```bash
# Compare staging migration history with the files in this checkout.
npm run db:status:staging
```

Kết quả mong đợi: CLI báo `Database schema is up to date!`.
Trong DBeaver, mở đúng connection staging → schema `public` → refresh `Tables`.
Bạn sẽ thấy các bảng như `User`, `Organization`, `Party`, `Debt` và `_prisma_migrations`.
Nếu lệnh tạo bảng báo lỗi, dừng và xem [migration lỗi](./migration-failure.md).

## Nếu DB trống là production

Sau khi cùng bộ migration đã chạy thành công ở staging:

1. Tạo `.env.production` từ `.env.example` nếu chưa có; điền cả hai URL **production**.
2. Xác nhận đúng DB đích và được giao quyền thực hiện.
3. Chạy tại root repository:

```bash
# Apply pending migrations using .env.production.
npm run db:deploy:production
# Verify production migration history after a successful deploy.
npm run db:status:production
```

## Sau khi có bảng

Deploy API với URL của đúng môi trường. Việc tạo bảng không tự copy dữ liệu dev hoặc tạo account QA.
Migration lịch sử của repo có tạo workspace legacy; đó là SQL có chủ đích, không phải bản sao DB dev.
Không chạy seed demo trên production; xem [chuẩn bị dữ liệu và account](./data-changes.md).
Nếu DB đích đã có bảng từ trước, dùng [quy trình DB có sẵn](./existing-database.md).

Nguồn về hành vi tạo schema: [Prisma 7 — migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy).
