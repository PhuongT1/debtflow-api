# Migration lỗi, drift hoặc yêu cầu reset

**Dùng khi:** CLI báo lỗi hoặc migration đang chạy thất bại.
**Mục tiêu:** xác định nguyên nhân trước khi chạy tiếp; giữ dữ liệu cần bảo toàn.

## 1. Dừng release và xác định môi trường

Ghi commit, migration name, mã lỗi và thông báo đã loại thông tin bí mật.
Xác nhận endpoint/DB đích. Không promote API sau khi migration thất bại.

## 2. Chọn đúng lỗi

| Hiện tượng | Bước tiếp theo |
| --- | --- |
| Không kết nối được | Kiểm tra URL, credentials, TLS và network của runner |
| `status` báo pending trước deploy | Có migration chưa apply; không đồng nghĩa SQL đã chạy lỗi |
| Thiếu quyền `pg_trgm` | Nhờ DBA chuẩn bị extension/quyền trên đúng DB |
| `migrate dev` thiếu quyền shadow DB | Cấu hình shadow DB dev riêng; không lấy staging/production thay thế |
| Drift/reset sau khi đổi nhánh | Đối chiếu migrations trong Git và DB; không reset nếu cần giữ dữ liệu |
| Constraint/backfill thất bại | Kiểm tra null, trùng hoặc giá trị không chuyển được theo nghiệp vụ |

## 3. Nếu một migration đã chạy dở

1. Xem migration SQL và `logs` của record tương ứng trong `_prisma_migrations`.
2. Kiểm tra trực tiếp bảng/index/constraint để biết bước nào đã hoàn thành.
3. Lập và review một trong hai hướng: hoàn tất phần SQL còn thiếu, hoặc khôi phục phần đã chạy.
4. Chỉ sau khi schema/dữ liệu đã được xử lý mới dùng `migrate resolve` theo kế hoạch recovery.
5. Kiểm tra `status`, cấu trúc thực tế và API trước khi tiếp tục release.

`resolve --rolled-back` không tự undo SQL; `resolve --applied` không tự tạo phần schema còn thiếu.
Không chạy chúng chỉ để bỏ qua lỗi. Không mặc định migration SQL được rollback toàn bộ khi thất bại.
Không sửa/xóa migration đã chia sẻ thành công; sửa schema bằng migration tiếp theo.

Với dev DB có thể bỏ hoàn toàn, reset chỉ được thực hiện sau khi xác nhận rõ dữ liệu có thể xóa.
Không dùng reset trên staging/production. Nếu DB có bảng nhưng chưa có lịch sử, xem [baseline](./existing-database.md).

Nguồn: [Prisma 7 — production recovery](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing),
[development troubleshooting](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/troubleshooting).
