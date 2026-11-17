# Triển khai staging

**Dùng khi:** kiểm tra artifact đã compile với cấu hình và DB staging. Không dùng watch hoặc seed demo
để khởi động staging. Chọn một cách chạy: standalone trên Node hoặc Vercel.

## 1. Chọn bản ứng viên

Dùng commit đã qua [CI và review](../ci/pull-requests.md). Với Vercel, nhánh `develop` là Preview/staging;
với host Node, ghi lại SHA của artifact. Không dùng DB dev hoặc production cho staging.

## 2. Chuẩn bị cấu hình và DB

Trên máy chạy standalone, tạo `.env.staging` nếu chưa có:

```bash
# Select Node and prepare a staging settings file without overwriting an existing one.
nvm use
npm ci
[ -f .env.staging ] || cp .env.example .env.staging
```

Điền **đầy đủ** URL DB staging, JWT secret, CORS và PORT của staging; đặt `NODE_ENV=staging` trong file.
Biến `NODE_ENV` khi khởi động bên dưới chọn file này trước `.env`. Kiểm tra không có URL của môi trường
khác đang được export trong shell vì biến shell được ưu tiên hơn file.

Nếu DB trống, theo [khởi tạo DB staging](../../database/migrations/index.md). Với DB đã có lịch sử,
chạy tại root checkout bản ứng viên trên runner có cả hai URL staging:

```bash
# Inspect staging history before applying this release's migrations.
npm run db:migrate:status:staging
# Apply reviewed pending migrations to staging.
npm run db:migrate:apply:staging
# Confirm staging history matches this release after a successful apply.
npm run db:migrate:status:staging
```

Status trước apply có thể báo pending và exit khác 0. Kiểm tra đúng tên migration, không xem đó là
bằng chứng apply thất bại. Nếu apply lỗi thì dừng, không chạy code mới nhận traffic.
Kết quả sau apply: `Database schema is up to date!`; cách đọc output ở
[migration-order](../../database/migrations/order.md).

Kiểm tra [thứ tự schema/code](./schema-changes.md) trước: DROP chỉ sau khi code/consumer cũ ngừng dùng.
Build/start không thay thế migration, và các ví dụ lệnh không phải pipeline tự chạy.

## 3. Build artifact

```bash
# Install locked dependencies and compile the application without changing database data.
npm run build
```

**Thành công:** lệnh kết thúc không lỗi, có `dist/src/main.js` và `dist/src/vercel.js`.
Build chạy generators → Nest compile/copy Swagger assets → rewrite aliases cho Node ESM.
Các giá trị cần cho Prisma config phải có sẵn; generate không kết nối hay migrate DB.

## 4. Chạy standalone với cấu hình staging

```bash
# Select staging settings and run the compiled application.
NODE_ENV=staging npm start
```

**Thành công:** terminal in URL Swagger `/docs` trên PORT staging. Mở Swagger, login bằng user staging
và gọi API được cấp quyền theo [kiểm tra login và phân quyền](../../database/users/verify-user-access.md).
Khi dùng host Node, đặt biến môi trường staging trên host thay vì đưa file `.env.staging` vào artifact.

## 5. Nếu staging chạy trên Vercel

Làm theo [Vercel: nhánh và env](../platforms/vercel.md). Kiểm tra Preview variables của `develop`,
build command và SHA trên deployment. Vercel dùng handler riêng, không chạy `npm start`.

## 6. Xác nhận staging đạt yêu cầu

Kiểm tra API login/list bằng user staging, scope/quyền, sort/pagination và phần thay đổi của release.
Đối chiếu trạng thái migration; lưu URL deployment và SHA để reviewer/tester kiểm tra cùng một bản.
Khi cần tài khoản kiểm thử, chạy `npm run db:user:seed:staging` theo [hướng dẫn DB](../../database/users/create-user.md).

**Thành công:** phần ảnh hưởng đã kiểm thử, CI của commit xanh, migration không lỗi và tester xác nhận
bản ứng viên. Sau đó tạo PR phát hành vào `main`; commit sau merge vẫn phải qua CI vì SHA có thể khác.
Xem [phát hành production](./production.md).
