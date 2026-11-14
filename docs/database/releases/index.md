# DB staging/production: chuẩn bị trước khi phát hành

**Dùng khi:** đưa API lên một môi trường dùng chung hoặc phát hành thay đổi schema.
Dev chỉ cần DB riêng để viết code; release cần DB đích, quyền chạy migration và người chịu trách nhiệm.

## DB dev cần đưa gì lên production?

| Nội dung | Cách chuyển qua các môi trường |
| --- | --- |
| Bảng, cột, index, constraint | Tạo migration ở dev → review/commit → apply cùng SQL ở staging → production |
| Code truy cập dữ liệu | Build/deploy release tương thích với schema đích |
| Dữ liệu thử ở dev | Giữ ở dev; không copy toàn DB sang production |
| Dữ liệu bắt buộc hoặc backfill | Kế hoạch/script riêng được review, đúng tenant và có kiểm chứng |
| Credentials và URL DB | Cấp riêng theo môi trường; không nằm trong Git hoặc image |

Ví dụ dev thêm `Party.website`: production không tự có cột đó khi push code. Release runner phải
apply migration đã commit. Không tạo lại migration hoặc export bảng dev để đưa lên production.

## Chọn tình huống đúng

| DB đích đang thế nào? | Làm gì tiếp? |
| --- | --- |
| Chưa có DB hoặc API chưa kết nối đúng | [Kết nối API và release runner](./connect-runtime.md) |
| DB trống, chưa có bảng | [Tạo schema từ toàn bộ lịch sử](../migrations/index.md), sau đó tạo account được cấp quyền |
| Đã có lịch sử Prisma, có migration mới | [Release code và DB từng bước](../../deployment/environments/production.md) |
| Đã có bảng nhưng chưa có lịch sử tương ứng | [Baseline DB có sẵn](../schema/existing-database.md); không chạy init mù |
| Đổi/xóa field, đổi kiểu hoặc xóa bảng | [Chọn thứ tự code và DB](../../deployment/environments/schema-changes.md) |
| Migration lỗi hoặc lịch sử khác nhau | [Xử lý lỗi](../schema/migration-failure.md); dừng release |

## Ai chạy, chạy ở đâu?

| Trách nhiệm | Nơi thực hiện | Quyền |
| --- | --- | --- |
| Viết model và sinh migration | Máy dev, DB dev riêng | Quyền dev/shadow DB |
| Apply SQL đã review | Release runner có checkout đúng release và Prisma CLI; có thể là máy maintainer hoặc job CD | Quyền schema trên DB đích |
| Chạy API | Vercel/host/container của môi trường đích | Credentials runtime phù hợp |
| Review/duyệt release | PR và hệ thống phát hành | Người được giao vận hành |

Release runner không nhất thiết là máy chứa PostgreSQL. Nó cần kết nối mạng tới DB đích.
Không gõ npm trong DBeaver; DBeaver dùng để đối chiếu SQL/bảng. Build và startup API hiện
không tự apply migration, nên thiếu bước runner là thiếu bước cập nhật DB.

## Đọc tiếp theo thứ tự

1. [Kết nối DB với API và release runner](./connect-runtime.md).
2. [Triển khai staging](../../deployment/environments/staging.md) để kiểm chứng cùng migration/code.
3. [Checklist production](../../deployment/environments/production.md), gồm trước/sau migration và deploy.
4. [Theo dõi và rollback](../../deployment/cd/operations.md).

Quy trình kỹ thuật về SQL nằm ở Database; trình tự phát hành code + DB nằm ở Triển khai.
Hai menu dẫn tới cùng trang nguồn, không duy trì hai checklist production khác nhau.
