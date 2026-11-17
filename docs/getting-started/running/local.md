# Chạy local và debug

**Dùng khi:** phát triển code trên máy với DB development riêng. Không dùng trang này để chạy staging/production.

## 1. Chuẩn bị lần đầu

```bash
# Select the project's Node version and install locked dependencies.
nvm use
npm ci
# Create local settings only when the file does not already exist.
[ -f .env ] || cp .env.example .env
```

Điền URL DB dev, JWT secret và các giá trị cần dùng trong `.env`; giữ `NODE_ENV=development`.
Chú thích từng biến nằm trong `.env.example`. Chuẩn bị bảng theo
[Dev mới: cập nhật DB riêng](../../database/local/index.md) trước khi gọi API cần DB.

```bash
# Generate Prisma client and metadata, then start the local watch server.
npm run db:generate
npm run dev
```

**Thành công:** terminal báo ứng dụng đã khởi động và in `Swagger UI: <URL>/docs`.
Mở đúng URL đó; port lấy từ `PORT` trong cấu hình, không cố định trong tài liệu.

## 2. Làm việc hằng ngày

```bash
# Start local watch mode; saving source files rebuilds and restarts the API.
npm run dev
```

Watch/debug ghi ra `dist-dev/`, tách với `dist/` của bản build. Không gọi `nest start --watch`
trực tiếp vì sẽ bỏ qua cấu hình output/alias của dự án. Khi nhận thay đổi Prisma schema,
làm theo [cập nhật DB riêng](../../database/local/index.md), rồi generate lại client.

Nếu cần bộ dữ liệu demo trên DB dev được phép ghi, `npm run setup:dev` thực hiện
`db:migrate:dev → db:generate → db:seed:demo → dev`. Lệnh này có ghi DB; không dùng thay
cho lệnh chạy API hằng ngày. Xem [Dữ liệu demo và backfill](../../database/data-changes.md).

## 3. Debug trong VS Code

1. Dừng process API khác đang chiếm `PORT`.
2. Đặt breakpoint ở controller/service/adapter cần kiểm tra.
3. Mở **Run and Debug**, chọn **NestJS: Debug (one click)** và nhấn `F5`.
4. Gọi API từ Swagger/Postman; debugger dừng ở breakpoint.

Profile tự chạy API; không chạy thêm `dev`/`debug` cùng lúc. Nếu muốn attach thủ công:

```bash
# Start watch mode with the Node inspector enabled.
npm run debug
```

Chọn **NestJS: Attach to npm run debug**, nhấn `F5`; terminal cần báo `Debugger attached`.
`F10` đi qua dòng, `F11` vào hàm, `Shift+F11` ra khỏi hàm, `F5` tiếp tục.

Lỗi khởi động: xem [Xử lý lỗi](./troubleshooting.md).
