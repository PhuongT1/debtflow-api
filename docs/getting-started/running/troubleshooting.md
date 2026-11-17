# Xử lý lỗi khởi động

**Dùng khi:** API không chạy được sau khi làm theo hướng dẫn local, staging hoặc production.
Không chạy migrate/reset/seed như một cách thử sửa lỗi kết nối.

| Triệu chứng | Kiểm tra và cách xử lý | Dấu hiệu đã sửa |
| --- | --- | --- |
| `P1001` hoặc không tới được PostgreSQL | Kiểm tra đúng env/host/port, trạng thái DB và quyền mạng. Không in URL thật; xem [cấu hình kết nối](../../database/configure-connection.md) | API kết nối được và request được cấp quyền chạy thành công |
| Thiếu generated Prisma client/list-query metadata | Chạy lệnh generate bên dưới; nếu chạy artifact thì build lại | File generated tồn tại, API khởi động được |
| `ERR_MODULE_NOT_FOUND` trỏ `dist/main`/alias | Dùng package script; local dùng `dist-dev/`, build dùng `dist/`. Restart watcher sau khi đổi config. Xem [ESM](../../development/source/import-aliases.md) | Node tìm đúng entrypoint/import đã rewrite |
| `EADDRINUSE` | Dừng process đang chiếm PORT hoặc chọn PORT khác trong env | Chỉ một process lắng nghe port đích |
| `EMFILE: too many open files, watch` | Dừng các watcher không dùng; kiểm tra giới hạn file descriptor của máy. `nest-cli.json` đã tắt asset watching toàn cục | Watcher khởi động và rebuild khi lưu source |
| Thiếu biến môi trường hoặc JWT secret không hợp lệ | Đối chiếu `.env.example`; đặt `NODE_ENV` từ shell/host để chọn file trước khi bootstrap | Không còn lỗi config validation |

```bash
# Regenerate client and metadata without applying migrations or seeding data.
npm run db:generate
```

Nếu chạy code đã compile, chạy lại `npm run build` sau khi sửa source/config rồi start theo
[staging](../../deployment/environments/staging.md) hoặc [production](../../deployment/environments/production.md).
Nếu cần tạo/cập nhật bảng, dùng [Database workflow](../../database/index.md) thay vì xử lý trong trang này.
