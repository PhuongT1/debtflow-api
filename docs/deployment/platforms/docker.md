# Docker và host Node

**Dùng khi:** cần một image chạy trên host/container platform. Chuẩn bị Docker và biến runtime
cho đúng DB trước; migration là bước riêng trong [Database](../../database/index.md).

## 1. Build image

```bash
# Build the Node 24 runtime image from the repository Dockerfile.
docker build -t debtflow-api .
```

Dockerfile có các stage dependencies → build → runtime. Runtime chạy user `node` và chỉ giữ
production dependencies; `.dockerignore` loại env thật, cache và generated source khỏi build context.
Image build dùng URL giả để generate schema/client, không truy cập DB hoặc ghi schema/dữ liệu.

**Thành công:** Docker tạo image `debtflow-api` không lỗi.

## 2. Chạy với cấu hình đích

Ví dụ bên dưới dùng production và port 4000; file env phải là file thật trên host, không nằm trong image:

```bash
# Inject production settings at runtime and expose the configured API port.
docker run --rm --init --env-file .env.production -e NODE_ENV=production -p 4000:4000 debtflow-api
```

Với staging, dùng `.env.staging` và `-e NODE_ENV=staging`. Nếu `PORT` trong file khác 4000,
thay cổng container bên phải trong `-p <host-port>:<container-port>` cho khớp.

**Thành công:** container báo ứng dụng khởi động; mở `/docs` qua host port đã map và kiểm tra API
bằng user của môi trường đó. Container không migrate hoặc seed khi start.

## 3. Đưa image vào CD

Lệnh `docker run` ở trên là cách kiểm tra container, chưa phải hệ thống rollout production.
Pipeline container tương lai cần:

1. Build image từ SHA đã qua CI; gắn tag SHA và lưu digest ở registry.
2. Apply migration từ release runner riêng có Prisma CLI, chỉ một job cho môi trường đích.
3. Cấp secrets/PORT cho container platform và triển khai đúng digest, không đóng gói env thật.
4. Cấu hình restart, TLS/reverse proxy, readiness và graceful shutdown theo nền tảng.
5. Kiểm tra API trước/sau khi chuyển traffic; lưu digest cũ để rollback tương thích schema.

Repository hiện chưa có workflow push registry, manifest rollout hay health/readiness endpoint riêng.
Không khai báo một URL health giả để cho deploy pass. Nếu cần readiness tự động, bổ sung endpoint có
ý nghĩa rõ và test trước khi dùng. Giới hạn pool DB phải tính theo số instance, không chỉ một container.

## 4. Nếu dùng host Node thay vì container

Build và chạy artifact theo [production](../environments/production.md) hoặc
[staging](../environments/staging.md). Host cần process manager/service để restart và chuyển logs;
không dùng watch/dev server để vận hành production. Khi đổi nền tảng, giữ npm build/start và
PostgreSQL contract; thay phần rollout/secrets/network theo host, không viết lại nghiệp vụ.
