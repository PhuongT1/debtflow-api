# Kiểm tra AI đang dùng đã nhận rules

**Dùng sau:** [chạy setup](../ai-setup.md). Mở phiên AI mới trong thư mục checkout của dự án.

## Kiểm tra file theo công cụ

Các đường dẫn dưới là đầu ra của `scripts/ai/ai-setup.mjs`, không phải các bộ rules riêng.

| Công cụ | Điểm vào instructions | Skills được cài |
| --- | --- | --- |
| Codex | `AGENTS.md` tại gốc dự án dẫn tới core và rules riêng | `.agents/skills/`, đồng thời có bản `.codex/skills/` |
| Claude Code | `CLAUDE.md` nhập policy gốc, core index và context sinh ra | `.claude/skills/` |
| Cursor | `.cursor/rules/team-nestjs.mdc`, có `alwaysApply: true` | `.cursor/skills/` |
| GitHub Copilot | `.github/copilot-instructions.md` dẫn tới nguồn chung | Setup không cài tích hợp skills cho Copilot |
| Công cụ khác | Cấu hình instruction loader đọc `AGENTS.md` và `.ai/core/index.md` | Dùng nguồn `SKILL.md` nếu công cụ hỗ trợ |

## Xác nhận trước task đầu tiên

1. Chạy `npm run ai:check`; kết quả phải là `AI check passed`.
2. Mở lại phiên AI trong đúng repository; xem instructions/skills đã nạp nếu công cụ có mục này.
3. Yêu cầu AI xác định module, file và rule gốc liên quan trước khi sửa API đầu tiên.

Việc tìm và nạp instructions còn phụ thuộc phiên bản, thư mục làm việc và cấu hình cá nhân của
công cụ. `ai:check` kiểm tra file được cài; không chứng minh AI đã đọc hoặc tuân thủ mọi rule.

**Tiếp theo:** [Dùng skill khi viết code, review và commit](./use-skills.md).
