# Dùng skill khi viết code, review và commit

**Dùng khi:** đã [cài rules](../ai-setup.md) và chuẩn bị giao một task cụ thể cho AI.
Skills chọn quy trình làm việc; rules gốc quy định cách viết code.

## Chọn theo việc cần làm

| Công việc | Skill | Ví dụ yêu cầu |
| --- | --- | --- |
| Viết hoặc sửa API | `backend-change` | “Dùng $backend-change sửa filter tên của GET Party, giữ sort và phân trang.” |
| Kiểm tra thay đổi | `review` | “/review các thay đổi hiện tại; chỉ báo vấn đề, chưa sửa code.” |
| Tạo commit | `commit` | “/commit, nhóm các file cùng mục đích; chỉ commit local.” |

Tên slash là alias trong văn bản của dự án, không đảm bảo xuất hiện trong menu lệnh của editor.
Có thể diễn đạt yêu cầu bằng ngôn ngữ tự nhiên. Phạm vi và quyền thực hiện vẫn theo yêu cầu của bạn;
review không tự sửa code, commit không tự pull/push/deploy.

## Giao task đầu tiên

Nêu API/module, hành vi mong muốn và giới hạn công việc. Ví dụ:

```text
Sửa filter tên của GET /api/parties để tìm không phân biệt hoa thường.
Giữ tenant scope, sort và phân trang; chỉ kiểm tra phần ảnh hưởng.
```

Dẫn AI tới [kiến trúc](../../getting-started/architecture.md),
[flow request](../../getting-started/architecture/request-flow.md) và
[cách viết/sửa API](../../getting-started/module-development.md) khi cần hiểu implementation.
Với schema/migration, dùng [hướng dẫn Database](../../database/index.md) và xác định đúng môi trường trước.

## Đọc workflow thật ở đâu?

Mở `.ai/skills/SKILLS.md` trong checkout để xem danh sách và cách dùng. Các workflow gốc nằm tại
`.ai/core/skills/`; bản riêng tại `.ai/skills/` thay thế toàn bộ skill cùng tên theo `.ai/project.json`.
Không sửa bản cài trong các thư mục client. Sau khi sửa nguồn, làm theo [cập nhật rules](./update-rules.md).

Dùng [tìm rules theo công việc](../ai-development.md) để đọc đúng policy cho task, thay vì tạo
thêm checklist bắt buộc trong guide này. Quy tắc kiểm tra nằm tại
[phạm vi verification](/team/core/workflow/verification#keep-verification-proportional).
