# Tìm rules theo công việc

Dùng trang này để chọn đúng tài liệu trước khi giao việc cho AI hoặc sửa code. Nội dung quy tắc
được đọc tại nguồn trong bảng dưới; trang này chỉ hướng dẫn cách tìm và áp dụng.

## 1. Rules thật nằm ở đâu?

| Nguồn trong repository | Đọc trên website | Vai trò |
| --- | --- | --- |
| `AGENTS.md` | File tại gốc checkout | Điểm vào của agent, phạm vi công việc và liên kết tới các rule cần đọc |
| `.ai/core/index.md` và các topic | [Core NestJS](/team/core/) | Quy tắc dùng chung giữa các dự án |
| `docs/guides/backend-rules/` | [Rules DebtFlow](../guides/backend-rules/index.md) | Contract triển khai riêng của dự án |
| `.ai/project.json` | [AI setup](./ai-setup.md) | Cấu hình nguồn rule/skill và adapter cho từng AI client |
| `.ai/core/skills/`, `.ai/skills/` | [Dùng skill theo công việc](./ai-setup/use-skills.md) | Quy trình implementation, review và commit |

**Core trên website lấy trực tiếp từ `.ai/core/`; Rules DebtFlow render chính file gốc.** Không sửa
bản cài trong `.codex/`, `.agents/`, `.claude/` hoặc `.cursor/`. Cách cập nhật nguồn nằm ở
[Bảo trì tài liệu và rules](./documentation.md).

## 2. Bắt đầu dùng AI

Làm theo [Áp dụng AI rules sau khi clone](./ai-setup.md), sau đó kiểm tra công cụ đã nhận
instructions. Setup cài nguồn do team duy trì; không tạo thêm policy từ suy đoán nghiệp vụ.

## 3. Với task này, đọc gì trước?

| Công việc | Hướng dẫn thực hiện | Quy tắc gốc |
| --- | --- | --- |
| Hiểu hệ thống | [Kiến trúc](../getting-started/architecture.md), [request flow](../getting-started/architecture/request-flow.md) | [Cấu trúc và dependency](/team/core/architecture/structure) |
| Sửa hoặc thêm API | [Viết và bảo trì API](../getting-started/module-development.md) | [Chọn rules theo thay đổi](../guides/backend-rules/index.md#select-by-change) |
| Request/response | [Validation và errors](../development/http/validation-and-errors.md), [Swagger](../development/http/api-and-swagger.md) | [Validation](../guides/backend-rules/validation.md), [HTTP contract](../guides/backend-rules/http-contract.md) |
| Auth, quyền, tenant | [Authorization](../development/authorization.md) | [Security và tenancy](../guides/backend-rules/security-tenancy.md) |
| DB và transaction | [Persistence architecture](../development/persistence/persistence-architecture.md) | [Services và persistence](../guides/backend-rules/services-persistence.md) |
| Test/check phần thay đổi | [Testing](/team/core/workflow/testing) | [Phạm vi verification](/team/core/workflow/verification#keep-verification-proportional) |
| Review hoặc commit | [Skills](./ai-setup/use-skills.md) | Workflow tại `.ai/skills/`, `.ai/core/skills/` |

## 4. Giao task đủ thông tin

Nêu chức năng cần thay đổi, hành vi mong muốn, module/API liên quan và giới hạn phạm vi.
Ví dụ: “Sửa filter tên của GET Party; giữ tenant scope, sort và phân trang; chỉ kiểm tra phần ảnh hưởng.”
AI cần lần theo implementation hiện tại và rule tương ứng. Không cần nạp toàn bộ tài liệu cho mọi task.

Khi đổi kiến trúc hoặc quy trình, cập nhật nguồn có thẩm quyền cùng code; hướng dẫn chỉ dẫn tới nguồn đó.
Rules giúp member và AI làm nhất quán. Việc chặn vi phạm còn phụ thuộc guards, validation, constraints,
checks trong CI và branch protection; cài skill không tự cấu hình quyền merge.

Nguồn tham khảo đã đối chiếu nằm tại [Vendure source map](../guides/backend-rules/vendure-source-map.md).
Rules và skills không thay thế runtime guards, validation, database constraints và CI checks;
setup không cấu hình branch protection hay quyền merge.
