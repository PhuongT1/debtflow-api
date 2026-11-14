# Thay đổi schema: chọn thứ tự code và DB

**Dùng khi:** release thêm, sửa hoặc xóa bảng/field. Các tình huống dưới đây là kế hoạch thiết kế release;
lệnh thực hiện và điểm dừng nằm ở [checklist production](./production.md).
Mỗi giai đoạn phải đi qua dev → staging → production.

## 1. Không thay đổi schema

Chỉ sửa logic/API mà schema vẫn phù hợp: CI/test → kiểm tra migration history → deploy code → smoke.
Không tạo migration rỗng hoặc chạy seed để gọi là “đồng bộ DB”.

## 2. Thêm bảng hoặc field nullable

Ví dụ thêm `Party.website String?`:

1. Dev tạo SQL thêm bảng/cột và review default, foreign key, index.
2. Apply migration staging trước code dùng field; kiểm thử.
3. Production apply cùng SQL, xác nhận cột tồn tại.
4. Deploy code mới nhận/trả field và smoke test. Code cũ phải vẫn chạy được khi field mới tồn tại.

Đây thường là một release. Với bảng lớn hoặc constraint/index mới, phải đánh giá thời gian lock
và dữ liệu hiện có; “thêm” không tự đồng nghĩa không ảnh hưởng runtime.

## 3. Thêm field bắt buộc, NOT NULL hoặc unique

Không áp constraint ngay khi dữ liệu cũ chưa đáp ứng:

| Giai đoạn | DB | Code và kiểm chứng |
| --- | --- | --- |
| Mở rộng | Thêm nullable hoặc thiết kế default có ý nghĩa nghiệp vụ | Deploy code xử lý dữ liệu cũ và ghi giá trị mới |
| Điền dữ liệu | Backfill theo kế hoạch, xử lý null/trùng theo tenant | Bảo đảm write mới không tái tạo dữ liệu không hợp lệ |
| Siết constraint | Migration mới thêm NOT NULL/unique sau kiểm chứng | Test lỗi, quyền và đường ghi liên quan |

Default không được là giá trị giả chỉ để vượt constraint. Nếu dữ liệu vẫn có null/trùng, dừng
giai đoạn cuối. Backfill xem [hướng dẫn dữ liệu](../../database/data-changes.md).

## 4. Rename field hoặc đổi kiểu

Ví dụ `oldName` → `newName`:

1. Release A thêm field mới, giữ field cũ; code chuyển tiếp đọc/ghi theo kế hoạch tương thích.
2. Backfill, đối chiếu giá trị và dữ liệu mới phát sinh; xử lý lỗi chuyển đổi.
3. Release B chuyển API/worker/report sang field mới, ngừng dùng field cũ.
4. Đợi mọi instance/consumer cũ dừng và xác nhận rollback policy.
5. Release C mới có migration bỏ field cũ.

Prisma có thể sinh DROP + ADD khi rename. Review SQL trước khi apply; có thể dùng mapping
`@map` để đổi tên phía code mà giữ tên cột, hoặc custom SQL nếu có kế hoạch cutover phù hợp.
Không mặc định một câu `RENAME COLUMN` là an toàn khi code cũ vẫn đang dùng tên cột cũ.

Đổi kiểu cần kiểm chứng conversion, precision, giá trị không chuyển được và thời gian rewrite/lock.
Nếu code cũ không tương thích thì dùng field chuyển tiếp hoặc maintenance đã duyệt.

## 5. Xóa field hoặc bảng

**Code ngừng dùng trước; DROP sau ở release riêng.**

- Liệt kê consumer: API, Prisma projection, raw SQL, worker, report/export và integrations.
- Deploy bản đã bỏ read/write của field/bảng đó; xử lý dependency/FK theo kế hoạch.
- Xác nhận tất cả instance cũ dừng, dữ liệu được lưu/backup theo nhu cầu.
- Tạo/review migration DROP mới; rehearsal staging rồi apply production.
- Code quay lui sau DROP phải là bản không dùng phần đã xóa.

Không phát hành migration DROP trước khi code cũ đang phục vụ ngừng truy cập field/bảng đó.
Rollback deployment không phục hồi dữ liệu bị DROP.

## 6. DB production mới hoàn toàn

Tạo DB/credentials → áp dụng toàn bộ lịch sử đã kiểm thử → tạo dữ liệu/account vận hành bắt buộc →
cấp URL cho runtime → deploy → smoke. Không có dữ liệu dev trong production trừ bước nhập dữ liệu
được thiết kế/phê duyệt riêng. Theo [khởi tạo DB](../../database/migrations/index.md).

## 7. Có backfill hoặc migration dài

Lập kế hoạch batch, chạy tiếp/idempotency, kiểm chứng và tác động lock. Chỉ code không phụ thuộc dữ liệu
backfill hoàn tất mới được chạy trong giai đoạn chuyển tiếp. Không đặt mọi tác vụ dài vào startup
serverless hoặc mỗi replica. Xem [dữ liệu/backfill](../../database/data-changes.md).

Nguồn: [Prisma 7 — tùy chỉnh SQL trước khi apply](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations)
và [expand/contract](https://www.prisma.io/docs/guides/v7/database/data-migration).
