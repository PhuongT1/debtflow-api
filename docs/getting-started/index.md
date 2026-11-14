# Bắt đầu với DebtFlow API

Tài liệu này giúp dev mới hiểu kiến trúc, lần theo một request, sửa đúng chỗ và thêm module mới.
Đọc theo lộ trình dưới đây; không cần đọc hết phần tra cứu trước khi nhận task đầu tiên.

Để thiết lập DB, xem [Database](../database/index.md). CI/CD và phát hành staging/production
nằm riêng tại [Triển khai](../deployment/index.md).

## Đọc theo thứ tự

| Bước | Trang | Sau khi đọc bạn sẽ biết |
| --- | --- | --- |
| 1 | [Chạy dự án](./running/index.md) | Chọn Node, cấu hình môi trường, chạy BE và mở Swagger |
| 2 | [Áp dụng AI rules sau khi clone](../team/ai-setup.md) | Cài rules/skills từ nguồn thật; biết nơi sửa và đồng bộ |
| 3 | [Kiến trúc backend](./architecture.md) | Trách nhiệm từng layer và chiều phụ thuộc |
| 3.1 | [Clean Architecture và lý do lựa chọn](./architecture/clean-architecture.md) | Các layer, chiều phụ thuộc và phạm vi đã chuyển đổi |
| 3.2 | [Luồng request từ FE đến DB](./architecture/request-flow.md) | Thứ tự xử lý, file nào chạy và lỗi được trả về ở đâu |
| 3.3 | [Ví dụ thực tế: Party](./architecture/party-architecture.md) | Lần theo một API đang có từ controller tới DB và response |
| 4 | [Viết và bảo trì API](./module-development.md) | Sửa đúng owner, nối DI, tái sử dụng types và kiểm tra phần ảnh hưởng |

**Party là ví dụ đã áp dụng Clean Architecture; các module khác chưa chuyển hết.** Không sao chép toàn bộ file/folder
của Party cho một chức năng nhỏ.

## Sau lộ trình này, bạn cần làm được gì?

- Mở Swagger và gọi một API với user/tenant đúng.
- Tìm controller → service → repository binding → Prisma adapter của API đó.
- Biết nơi sửa request, response, query, nghiệp vụ và test tương ứng.
- Tìm đúng rule gốc khi cần thay đổi; không tạo thêm bản rules trong module.

## Khi đang làm một task

| Bạn cần làm gì? | Đọc trang nào? |
| --- | --- |
| Tìm đúng file để sửa | [Cách làm việc với module](./module-development.md#maintain-existing-feature) |
| Viết filter, sort, phân trang | [List query dùng chung](../development/persistence/list-query.md) |
| Hiểu quyền và tổ chức của user | [Authorization](../development/authorization.md) |
| Sửa schema hoặc migration | [Database workflow](../database/index.md) |
| Xem endpoint và dữ liệu nhận/trả | [Endpoint catalog](../generated/endpoints.md), [API reference](../generated/api-reference.md) |
| Áp dụng AI rules sau khi clone | [Cài rules cho công cụ đang dùng](../team/ai-setup.md), sau đó đọc `AGENTS.md` tại gốc repository |

## Quy tắc và tài liệu tra cứu

[Backend Rules](../guides/backend-rules/index.md) là quy tắc triển khai bắt buộc.
Các trang trong lộ trình giải thích cách áp dụng, không tạo thêm một bộ quy tắc khác.
[Sản phẩm](../reference/overview.md), [nghiệp vụ](../reference/business-rules.md) và [database](../database/overview.md)
giải thích bối cảnh khi bạn cần đi sâu vào tính năng.

`docs/generated/` được sinh từ code bằng `npm run docs:generate`; không sửa tay.
Các guide được cập nhật cùng thay đổi liên quan. Nguồn tham khảo và ADR nằm trong nhóm riêng,
không phải phần dev mới cần đọc hết trước khi bắt đầu.

## Mở tài liệu trên máy

```bash
npm run docs:dev
```

Mở URL VitePress in trong terminal, mặc định là `http://localhost:5173`.
Port của tài liệu độc lập với `PORT` của BE. Swagger thuộc BE tại `/docs`; website này là hướng dẫn phát triển.
