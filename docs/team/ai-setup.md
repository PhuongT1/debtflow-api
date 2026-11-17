# Áp dụng AI rules sau khi clone

**Mục tiêu:** để AI bạn dùng nhận đúng rules và skills của DebtFlow, không tự tạo một bộ quy tắc khác.
Chỉ cần cài một lần trên mỗi checkout; chạy lại khi nguồn rules/skills thay đổi.

## 1. Cài từ nguồn của dự án

Tại thư mục gốc repository, dùng phiên bản Node trong `.nvmrc`:

```bash
nvm use
npm run ai:setup
npm run ai:check
```

**Kết quả mong đợi:** terminal báo `AI setup complete`, sau đó `AI check passed`.
Mở lại phiên AI trong repository để nạp instructions mới.

Setup chạy offline, không đọc `.env`, kết nối DB, cài dependencies hay thay đổi cấu hình AI toàn máy.
Nó cũng không commit hoặc push code.

## 2. Kiểm tra công cụ của bạn

Mở [Kiểm tra AI đã nhận rules](./ai-setup/choose-client.md) để biết file nào được dùng bởi
Codex, Claude Code, Cursor hoặc Copilot. Nếu setup lỗi, xem [Cập nhật và xử lý lỗi](./ai-setup/update-rules.md).

## 3. Bắt đầu viết code

Chọn [skill theo công việc](./ai-setup/use-skills.md), rồi đọc
[kiến trúc BE](../getting-started/architecture.md) →
[luồng request](../getting-started/architecture/request-flow.md) →
[ví dụ Party](../getting-started/architecture/party-architecture.md) →
[cách viết và bảo trì API](../getting-started/module-development.md).
Khi cần tạo DB hoặc sửa schema, mở [Database theo tình huống](../database/index.md).

## Nguồn rules được dùng

| Nguồn | Mục đích |
| --- | --- |
| `AGENTS.md` | Điểm vào và hướng dẫn chọn rules của dự án |
| `.ai/core/` | Quy tắc NestJS dùng chung |
| `docs/guides/backend-rules/` | Contract triển khai DebtFlow |
| `.ai/core/skills/`, `.ai/skills/` | Workflow theo task |
| `.ai/project.json` | Khai báo các nguồn trên và commands tham chiếu |

Website đọc [core từ file gốc](/team/core/) và hiển thị [rules DebtFlow](../guides/backend-rules/index.md)
ngay tại owner. Guide này chỉ hướng dẫn áp dụng. Setup không suy đoán nghiệp vụ hay sinh policy mới.
Xem [Tìm rules theo công việc](./ai-development.md) khi nhận task cụ thể.

Để dùng cho repository khác, mở [Mang bộ rules sang dự án NestJS khác](./ai-setup/reuse-in-project.md).
