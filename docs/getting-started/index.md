# Bắt đầu với DebtFlow API

Tài liệu này giúp dev mới hiểu kiến trúc, lần theo một request, sửa đúng chỗ và thêm module mới.
Bắt đầu với lộ trình dưới đây; các quy tắc chi tiết và API reference nằm ở nhóm tra cứu trong sidebar.

Để thiết lập DB hoặc chuẩn bị release, xem [Database: dev, staging và production](../database/index.md).

## Đọc theo thứ tự

| Bước | Trang | Sau khi đọc bạn sẽ biết |
| --- | --- | --- |
| 1 | [Chạy dự án](../getting-started/run-source.md) | Chuẩn bị môi trường, chạy BE và mở Swagger |
| 2 | [Kiến trúc backend](../getting-started/architecture.md) | Các layer, trách nhiệm và chiều phụ thuộc |
| 3 | [Một request từ FE đến DB](../getting-started/request-flow.md) | Thứ tự xử lý, file nào chạy và lỗi được trả về ở đâu |
| 4 | [Ví dụ thực tế: Party](../getting-started/party-architecture.md) | Áp dụng kiến trúc chung vào module đang có |
| 5 | [Sửa chức năng và thêm module](../getting-started/module-development.md) | Chọn đúng owner, nối DI, tái sử dụng types và kiểm tra phần ảnh hưởng |

**Party là ví dụ minh họa.** Kiến trúc chung áp dụng cho mọi module; không sao chép toàn bộ file/folder
của Party cho một chức năng nhỏ.

## Khi đang làm một task

| Bạn cần làm gì? | Đọc trang nào? |
| --- | --- |
| Tìm đúng file để sửa | [Cách làm việc với module](../getting-started/module-development.md#maintain-existing-feature) |
| Viết filter, sort, phân trang | [List query dùng chung](../development/list-query.md) |
| Hiểu quyền và tổ chức của user | [Authorization](../development/authorization.md) |
| Sửa schema hoặc migration | [Database workflow](../database/index.md) |
| Xem endpoint và dữ liệu nhận/trả | [Endpoint catalog](../generated/endpoints.md), [API reference](../generated/api-reference.md) |
| Thiết lập AI của team | [AI setup](../team/ai-setup.md), sau đó đọc `AGENTS.md` tại gốc repository |

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
