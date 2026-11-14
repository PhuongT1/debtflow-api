# Áp dụng migration: tạo mới và cập nhật DB

**Dùng khi:** DB staging/production cần nhận các migration đã review trong bản code phát hành.
`migrate:apply` dùng cho cả DB trống và DB đã có lịch sử Prisma; không phải lệnh deploy API.
Trang này dùng **staging** làm ví dụ, chạy trong Terminal tại root repository.

## 1. Chọn đúng tình huống

| Trạng thái DB hoặc thay đổi | Cách xử lý |
| --- | --- |
| DB trống, chưa có bảng | Apply toàn bộ lịch sử migration theo thứ tự để tạo schema. |
| DB đã có lịch sử Prisma; thêm bảng/cột/index có migration mới | Cùng lệnh apply, chỉ chạy các migration chưa áp dụng; không tạo lại bảng cũ. |
| Đã áp dụng hết migration trong checkout | Apply không chạy lại SQL; báo không còn migration mới. |
| Đã sửa `schema.prisma` nhưng chưa tạo migration | Tạo migration ở [DB dev](../local/change-schema.md), review/commit rồi mới phát hành. Apply không tự sinh SQL từ model. |
| Đã có bảng nhưng không có lịch sử migration tương ứng | Làm [baseline](../schema/existing-database.md) trước; không apply toàn bộ lịch sử lên bảng đã có. |
| Rename, đổi kiểu, thêm field bắt buộc, DROP hoặc backfill | Lập [thứ tự code và DB](../../deployment/environments/schema-changes.md), đảm bảo tương thích và dữ liệu trước khi apply. |
| Migration thất bại hoặc schema/lịch sử bị lệch | Dừng phát hành, theo [xử lý lỗi và drift](../schema/migration-failure.md). Không reset DB vận hành. |

Không copy bảng/dữ liệu dev lên staging hoặc production. Những gì thay đổi trong DB phụ thuộc **SQL
của migration**, không phụ thuộc tên lệnh: phải review SQL, nhất là khi DB đang có dữ liệu.

## 2. Chuẩn bị đúng môi trường

Dùng checkout chứa các migration cần phát hành. Chọn Node và cài dependencies:

```bash
nvm use
npm ci
```

Chuẩn bị `.env.staging` theo [hướng dẫn kết nối](../configure-connection.md). Cả `DATABASE_URL` và
`DIRECT_URL` phải trỏ tới cùng DB staging. Xác nhận DB đích và quyền thực hiện; với dữ liệu đang dùng,
chuẩn bị backup/restore và kế hoạch tương thích trước thay đổi schema.

## 3. Kiểm tra trước → apply → kiểm tra sau

**Trước:** xem migration nào còn thiếu:

```bash
npm run db:migrate:status:staging
```

**Nếu đã áp dụng hết**, output cuối sẽ là:

```text
10 migrations found in prisma/migrations

Database schema is up to date!
```

Status kết thúc thành công, Terminal trở lại dấu nhắc: không cần chạy apply nữa.
Chuyển sang đối chiếu thay đổi và kiểm tra API. Dòng `10 migrations found` chỉ là số thư mục trong
source; phải có kết quả cuối mới biết DB đã nhận đủ chưa. Số migration thay đổi theo checkout.

**Nếu còn migration thiếu**, ví dụ:

```text
Following migration(s) have not yet been applied:
20261102100000_optimize_party_list_indexes
```

CLI có thể trả exit code 1 vì còn pending. Review danh sách và tiếp tục apply bên dưới;
đây chưa phải lỗi thực thi SQL. Nếu có failed migration, lỗi kết nối hoặc lịch sử không khớp,
dừng và xử lý trước khi tiếp tục.

**Áp dụng SQL đã review:**

```bash
npm run db:migrate:apply:staging
```

| DB đích | Output mong đợi |
| --- | --- |
| DB trống | `Applying migration ...` cho toàn bộ lịch sử, kết thúc `All migrations have been successfully applied.` |
| Đã có lịch sử và có migration mới | Chỉ thấy tên migration còn thiếu, cùng dòng kết thúc thành công. |
| Không có migration mới | `No pending migrations to apply.` |
| Gặp lỗi | Dừng tại lỗi; không deploy code yêu cầu schema mới. Theo trang xử lý lỗi. |

**Sau:** xác nhận cùng checkout không còn migration thiếu:

```bash
npm run db:migrate:status:staging
```

Kỳ vọng: `Database schema is up to date!`. Status kiểm tra **lịch sử migration**, không chứng minh schema
không bị sửa tay, backfill đúng hoặc API đã hoạt động. Đối chiếu bảng/cột/index trong DBeaver và kiểm tra
API liên quan theo kế hoạch phát hành.

[Chạy và kiểm tra migration](./order.md) mô tả thứ tự từng file, output và truy vấn đối chiếu lịch sử.

## 4. Khi môi trường đích là production

Sau khi cùng migration đã được kiểm chứng ở staging, làm [quy trình production](../../deployment/environments/production.md).
Runner dùng `.env.production` và hai lệnh tương ứng:

```bash
npm run db:migrate:apply:production
npm run db:migrate:status:production
```

Thời điểm apply so với deploy phụ thuộc loại thay đổi; xem bảng tình huống ở trên.
Không chạy `migrate dev`, reset hoặc seed demo trên production.

## 5. Tài khoản và dữ liệu là công việc riêng

Migration không tự tạo nhóm user QA hoặc copy dữ liệu dev. Xem [Tài khoản dev và kiểm thử](../users/create-user.md)
và [dữ liệu/backfill](../data-changes.md). Có thể tạo tài khoản sau lần khởi tạo DB hoặc khi DB đã vận hành.

Nguồn: [Prisma migrate deploy](https://www.prisma.io/docs/cli/v7/migrate/deploy).
