# Chạy dự án trên máy dev

**Dùng khi:** mới clone source, phát triển API hoặc debug trên máy. Tất cả lệnh chạy tại root
repository `debtflow-api`.

| Bạn cần làm gì? | Hướng dẫn |
| --- | --- |
| Chuẩn bị lần đầu, chạy watch và debug | [Chạy local và debug](./local.md) |
| Không khởi động được, lỗi kết nối hoặc generated files | [Xử lý lỗi khởi động](./troubleshooting.md) |
| Đưa code lên staging/production | [Triển khai và CI/CD](../../deployment/index.md) |

## Các lệnh local có tác dụng gì?

| Lệnh | Mục đích | Ghi schema/dữ liệu DB? |
| --- | --- | --- |
| `npm run dev` | Chạy source với watch; output riêng `dist-dev/` | Không tự migrate/seed |
| `npm run build` | Generate Prisma, compile ESM và copy assets vào `dist/` | Không |
| `npm start` | Chạy `dist/src/main.js` đã build | Không tự migrate/seed |
| `npm run setup:dev` | Migrate dev, generate, seed demo rồi chạy watch | **Có**; chỉ dùng DB dev được phép ghi |

Khởi tạo/cập nhật bảng theo [Database](../../database/index.md). Build không tự chọn DB;
cấu hình runtime mới xác định môi trường đích.

Swagger thuộc API tại `/docs` trên `PORT` của API. Website hướng dẫn này chạy bằng
`npm run docs:dev`, độc lập với API.
