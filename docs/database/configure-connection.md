# Tạo database và chọn đúng kết nối

**Dùng khi:** chưa có PostgreSQL hoặc chưa cấu hình URL của môi trường cần thao tác.
**Kết quả:** có DB riêng và file env riêng; chưa có bảng nghiệp vụ.

## 1. Tạo database PostgreSQL

Trên AWS RDS, Neon hoặc dịch vụ đang dùng:

1. Chọn PostgreSQL; tạo DB riêng, ví dụ `debtflow_staging` hoặc `debtflow_production`.
2. Nếu tạo từ database branch, chọn bản trống nếu không muốn sao chép dữ liệu branch cha.
3. Tạo credentials riêng; cho phép kết nối từ API và máy/job chạy migration.
4. Lấy URL và yêu cầu TLS từ nhà cung cấp. Không tự sửa hostname để đoán endpoint.
5. Kiểm tra quyền tạo bảng/index/enum. Migration hiện có cần extension `pg_trgm`;
   nếu tài khoản migration không được tạo extension, nhờ DBA chuẩn bị trên đúng DB.

Nếu dùng PostgreSQL local, mở **SQL Editor** trong DBeaver, kết nối database `postgres`,
bật autocommit rồi chạy riêng câu lệnh (cần quyền tạo database):

```sql
CREATE DATABASE debtflow_dev_member;
```

## 2. Tạo file env theo môi trường

Chạy tại root repository với Node 24. Chỉ copy nếu file đích chưa tồn tại:

```bash
# Use the Node.js version specified in this project’s .nvmrc.
nvm use
# Install the exact dependencies in package-lock.json; replace existing node_modules.
npm ci
# Create local development settings; skip if .env already exists.
cp .env.example .env
# Create staging settings from the template; skip if the file exists.
cp .env.example .env.staging
# Create production settings from the template; skip if the file exists.
cp .env.example .env.production
```

Điền giá trị thật trong file của môi trường cần dùng:

| File | DATABASE_URL | DIRECT_URL |
| --- | --- | --- |
| `.env` | DB development của dev | Cùng DB dev, endpoint trực tiếp |
| `.env.staging` | DB staging | Cùng DB staging, endpoint trực tiếp |
| `.env.production` | DB production | Cùng DB production, endpoint trực tiếp |

Có thể dùng cùng URL cho cả hai biến nếu không có pooler/proxy.
Các file thật được Git ignore; không commit credentials.

**Riêng CLI của repo:** `prisma.config.ts` tự đọc `.env`, không tự chọn `.env.staging` theo
`NODE_ENV`. Vì thế các lệnh ở trang sau dùng `node --env-file=...` và yêu cầu **cả hai URL** trong
file đích, tránh `DIRECT_URL` dev được bổ sung từ `.env`.
Đừng sửa `.env` dev để chuyển qua lại giữa các DB.

## 3. Xác nhận database đích

Mở connection DBeaver đúng endpoint vừa lấy. Trong **SQL Editor**, chạy:

```sql
SELECT current_database() AS database_name, current_user AS database_user;
```

Đối chiếu cả endpoint, tên database và user. Không dán SQL đầy đủ vào ô filter của tab Data.
Sau đó chọn [khởi tạo DB trống](./initialize-empty.md) hoặc [cập nhật bảng/field](./add-tables-fields.md).

## API trên Vercel dùng env nào?

| Deployment | Nơi cấu hình secrets | Database |
| --- | --- | --- |
| Nhánh `develop` | Preview, giới hạn cho `develop` | Staging |
| Nhánh `main` | Production; Production Branch đặt là `main` | Production |

API cần thêm `JWT_SECRET` riêng và `CORS_ORIGIN` trỏ FE tương ứng. Redeploy sau khi đổi env.
Staging có thể chạy `NODE_ENV=production`; URL mới quyết định DB nào được dùng.
Thiết lập backup/restore và quyền runtime trước khi dùng production.

Cách chọn file và nhánh ở trên được đối chiếu với `prisma.config.ts`, `src/config/app.config.ts`
và `vercel.json` của repo; không phải cơ chế tự chọn môi trường của Prisma.
