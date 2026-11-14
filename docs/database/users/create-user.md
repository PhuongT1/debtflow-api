# Tài khoản dev và kiểm thử

**Dùng khi:** cần tài khoản đăng nhập với nhiều quyền trên DB dev/staging đã có schema.
Có hai cách: tạo sẵn nhóm tài khoản mẫu, hoặc tạo riêng một tài khoản. Việc này độc lập với migration;
DB vừa tạo hoặc DB đã có dữ liệu đều dùng được.

## 1. Tạo sẵn nhóm user — không cần nhập tham số

Xác nhận `.env` trỏ đúng DB development, sau đó chạy tại root repository:

```bash
npm run db:user:seed:dev
```

Với staging, chuẩn bị `.env.staging` và chạy:

```bash
npm run db:user:seed:staging
```

Không hỏi email/password/role, không cần tìm organization ID. Script tìm workspace có slug
`default-workspace`, tạo nếu chưa có; không tự chọn organization bất kỳ đang tồn tại.
Mỗi môi trường dùng DB riêng theo [cấu hình kết nối](../configure-connection.md).

## Tài khoản có sẵn

| Email đăng nhập | Quyền trong workspace |
| --- | --- |
| `owner@qa.debtflow.local` | OWNER |
| `admin@qa.debtflow.local` | ADMIN |
| `admin1@qa.debtflow.local` | ADMIN |
| `admin2@qa.debtflow.local` | ADMIN |
| `accountant@qa.debtflow.local` | ACCOUNTANT |
| `viewer@qa.debtflow.local` | VIEWER |

Mật khẩu mẫu cho **tài khoản mới**: `Abcd@1234`. Đây là dữ liệu thử công khai cho dev/staging;
không dùng cho tài khoản thật. Tất cả có system role `USER`; OWNER/ADMIN ở đây chỉ là quyền trong
workspace, không phải quản trị toàn hệ thống. Tên cố định giúp chạy lại và chia sẻ kịch bản kiểm thử.

## 2. Nhận biết kết quả và chạy lại

Terminal in đúng môi trường/DB/host (không in connection string), rồi bảng gồm `result`, `userId`,
`email`, `organizationId`, `role` và dòng `Test accounts ready.`

| Kết quả | Ý nghĩa |
| --- | --- |
| `CREATED` | Tạo user và membership ACTIVE; có audit cùng transaction. |
| `UNCHANGED` | Email đã có đúng quyền/trạng thái trong workspace; giữ nguyên password và dữ liệu. |
| Lỗi quyền/trạng thái không khớp | Dừng; không tự nâng quyền, reset mật khẩu hoặc kích hoạt lại tài khoản. |
| Lỗi kết nối/schema | Dừng; kiểm tra env và [áp dụng migration](../migrations/index.md). |

Mỗi tài khoản có transaction riêng. Nếu lỗi ở tài khoản thứ ba, hai tài khoản đã hoàn tất vẫn còn;
chạy lại sẽ bỏ qua tài khoản phù hợp rồi tiếp tục. Mật khẩu mẫu không ghi đè password đã đổi.
Nhóm user không tự sinh Party, nợ hoặc dữ liệu demo; [dữ liệu nghiệp vụ](../data-changes.md) là bước riêng.

## 3. Tạo riêng một user hoặc tạo account production

Dùng công cụ hiện có khi cần email, mật khẩu, role hoặc organization cụ thể:

```bash
npm run db:user:create:staging
```

Terminal cho chọn `1. OWNER`, `2. ADMIN`, `3. ACCOUNTANT`, `4. VIEWER`; nhập email, tên và mật khẩu ẩn.
Enter ở role chọn VIEWER. Password phải theo validation API: tối thiểu 8 ký tự, có chữ và số;
`1234` không hợp lệ. Không nhận password qua command line.

Với development dùng `db:user:create:dev`. Với production được giao quyền tạo account, chạy:

```bash
npm run db:user:create:production
```

Dùng mật khẩu riêng cho từng người. Lệnh nhóm mẫu **chặn production trong code**, không có alias seed
production. Cả hai công cụ dùng chung validation, transaction và kiểm tra trạng thái; không sửa SQL trực tiếp
để gán quyền. `.env.staging` phải thật sự trỏ tới DB staging; tên môi trường không xác minh thay bạn DB đích.

Khi cần organization cụ thể, có thể truyền ID được cấp thay vì workspace mặc định:

```bash
npm run db:user:create:staging -- --organization-id ORGANIZATION_ID
```

## 4. Kiểm tra tài khoản

Làm theo [Kiểm tra login và phân quyền](./verify-user-access.md): đăng nhập đúng API, kiểm tra context
organization/role, quyền đọc/ghi và tenant isolation. Không đưa mật khẩu thật hoặc token vào ticket/Git.

Nguồn thực thi: `scripts/database/seed-users.ts` gọi `provisionUser` trong `create-user.ts`;
không có bộ logic tạo user thứ hai.
