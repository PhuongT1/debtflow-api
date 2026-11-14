# Cập nhật rules và xử lý lỗi setup

**Dùng khi:** vừa nhận thay đổi rules/skills từ repository hoặc `ai:check` báo bản cài đã cũ.

## Đồng bộ bản cài trên máy

Sau khi cập nhật source theo quy trình Git của team, chạy tại gốc repository:

```bash
npm run ai:setup
npm run ai:check
```

**Thành công:** thấy `AI setup complete` và `AI check passed`. Mở phiên AI mới để nạp instructions.
Không cần tạo lại rules bằng prompt hoặc sửa từng bản cài của Codex, Claude và Cursor.

## Nếu setup báo conflict

Setup kiểm tra toàn bộ đầu ra trước khi ghi. `.ai/local-state.json` lưu hash để nhận biết file do
setup quản lý. File đã bị sửa hoặc file khác đang chiếm đường dẫn sẽ không bị ghi đè.

1. Đọc đường dẫn conflict trong lỗi; so sánh với nguồn tại `.ai/core/skills/` hoặc `.ai/skills/`.
2. Giữ lại thay đổi cần thiết: chuyển vào nguồn do team duy trì, hoặc sao lưu ra ngoài đường dẫn được quản lý.
3. Chạy lại setup và check; không xóa nguồn rules để làm lỗi biến mất.

Không có cờ ép ghi đè. Skills cá nhân khác tên được giữ nguyên. Tài nguyên đã bỏ khỏi nguồn chỉ
được xóa khỏi bản cài nếu hash vẫn khớp; symlink, đường dẫn ngoài repo và cấu hình không hợp lệ bị từ chối.
`AGENTS.md` do team viết được giữ lại và phải dẫn tới `.ai/core/index.md`.

## Sửa ở đâu, commit gì?

| Cần thay đổi | Sửa nguồn |
| --- | --- |
| Quy tắc NestJS dùng chung | `.ai/core/` |
| Contract riêng DebtFlow | `AGENTS.md`, `docs/guides/backend-rules/` |
| Workflow cho task | `.ai/core/skills/` hoặc bản thay thế tại `.ai/skills/` |
| Nguồn rules/skills và commands của dự án | `.ai/project.json` |

Commit nguồn được duy trì và cấu hình liên quan. Các bản cài client, `.ai/generated/` và local state
được ignore bằng đường dẫn cụ thể; không ignore toàn bộ `.ai/`, `.github/` hoặc thư mục client.

```bash
git status --short
git check-ignore .agents/skills/review/SKILL.md .ai/local-state.json CLAUDE.md
```

`ai:check` chỉ đọc; lỗi có thể do thiếu/cũ/conflict đầu ra hoặc thiếu ignore block. Setup không sửa
Git index. Nếu đầu ra local đã được track từ trước, cần review và xử lý Git riêng, không xóa nguồn gốc.

Xem [bảo trì tài liệu và rules](../documentation.md) cho cách cập nhật đúng owner.
