# DB đã có bảng/dữ liệu nhưng thiếu lịch sử migration

**Dùng khi:** DB đích đã có bảng tạo thủ công/import, và không có lịch sử Prisma tương ứng.
**Không áp dụng:** DB trống hoặc DB chỉ đang thiếu vài migration đã commit.

## 1. Xác định trạng thái thật

1. Backup dữ liệu và thử trên bản sao được phép dùng.
2. Chạy `migrate status` bằng đúng file env theo [kết nối DB](./configure-connection.md).
3. Kiểm tra bảng, index, enum và `_prisma_migrations` trong DBeaver.
4. Đối chiếu schema thực tế với từng migration của repository.

## 2. Chọn cách đưa DB về lịch sử của repo

- Nếu DB tương ứng chính xác với một mốc migration, maintainer có thể lập kế hoạch baseline
  các migration đã được thực hiện về mặt cấu trúc/dữ liệu, sau đó deploy phần còn thiếu.
- Nếu schema khác lịch sử repo, cần kế hoạch reconcile các khác biệt trước khi baseline.
  Không tạo một migration init mới tùy tiện trong repo đã có lịch sử dùng chung.

`migrate resolve --applied` chỉ đánh dấu lịch sử, **không chạy SQL**.
Vì chưa biết DB cụ thể đang có những thay đổi nào, trang này không đưa một lệnh đánh dấu
hàng loạt để copy chạy. Quyết định từng migration phải dựa trên kết quả đối chiếu.

## 3. Xác nhận hoàn tất

Schema thực tế khớp mốc đã baseline, dữ liệu cần giữ còn đúng, migration còn thiếu đã apply,
và API tương ứng hoạt động. `status` thành công riêng lẻ không chứng minh schema không bị drift.
Không xóa bảng nghiệp vụ hoặc `_prisma_migrations` để làm CLI hết báo lỗi.

Nguồn: [Prisma 7 — baselining](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining).
