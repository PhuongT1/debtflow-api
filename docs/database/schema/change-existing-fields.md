# Đổi tên, đổi kiểu, xóa field hoặc thêm field bắt buộc

**Dùng khi:** thay đổi có thể ảnh hưởng dữ liệu cũ hoặc bản API đang chạy.
Trình tự phát hành code và DB theo từng trường hợp nằm ở [các tình huống schema](../../deployment/environments/schema-changes.md);
lệnh thực hiện ở [checklist production](../../deployment/environments/production.md).
**Ví dụ:** thay `oldName` bằng `newName` mà vẫn giữ giá trị đã có.

## 1. Mở rộng schema trước

Thêm `newName` nullable, giữ `oldName`. Tạo/review migration ở dev theo
[thêm bảng/field](../local/change-schema.md), rồi apply lên staging và production.
Chưa xóa `oldName`; bản API cũ vẫn cần chạy được.

## 2. Chuyển API và dữ liệu

1. Deploy API có thể đọc dữ liệu chuyển tiếp và ghi cả hai field khi cần.
2. Chuẩn bị backfill được review: nguồn, đích, cách chuyển giá trị và tenant scope.
3. Chạy backfill trên staging; kiểm tra giá trị lỗi, null và tổng số bản ghi.
4. Sau khi kết quả đúng và có backup, chạy kế hoạch tương ứng trên production.
5. Xác nhận dữ liệu mới phát sinh trong lúc backfill cũng được xử lý.

Backfill có thể nằm trong migration SQL hoặc script riêng. Với dữ liệu lớn, chọn batch và
khả năng chạy tiếp; không mặc định UPDATE toàn bảng trong lúc người dùng đang sử dụng.

## 3. Thu hẹp schema sau

Chuyển toàn bộ API/worker sang field mới. Khi không còn consumer dùng field cũ,
tạo **migration mới** để bỏ field cũ hoặc thêm constraint, rồi phát hành qua staging trước.
Rollback API không tự khôi phục cột hoặc dữ liệu đã xóa.

## Các trường hợp khác

| Thay đổi | Cách triển khai |
| --- | --- |
| Thêm `NOT NULL` vào bảng có dữ liệu | Thêm nullable → điền dữ liệu đúng nghiệp vụ → kiểm tra null → siết constraint |
| Thêm unique constraint | Kiểm tra/trị trùng theo tenant trước khi tạo constraint |
| Đổi kiểu dữ liệu | Thử chuyển trên dữ liệu đại diện; xác định cách xử lý giá trị không chuyển được |
| Xóa field/bảng | Ngừng mọi consumer, xác nhận dữ liệu không cần giữ và backup trước migration xóa |

**Hoàn tất khi:** API cũ không còn cần field cũ, dữ liệu đã chuyển đủ, constraint mới hợp lệ.
Không chấp nhận SQL `DROP` tự sinh chỉ vì CLI không báo lỗi.

Nguồn: [Prisma 7 — expand and contract](https://www.prisma.io/docs/guides/v7/database/data-migration).
