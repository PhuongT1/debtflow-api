# CI: kiểm tra code trước khi merge

**Dùng khi:** cần biết pipeline đang chạy gì, chỗ nào định nghĩa rule và kiểm tra nào còn thiếu.
Nguồn thực thi là `.github/workflows/quality.yml` và `package.json`;
trang này giải thích các lệnh đó, không tạo một bộ AI/backend rules mới.

## Khi nào CI chạy?

Workflow `API quality` chạy khi có `pull_request` hoặc `push`, hiện không giới hạn branch/path.
Một job `quality` chạy trên Ubuntu, Node 24, npm cache; quyền GitHub chỉ `contents: read`.
Các Actions đang được khóa theo commit SHA.

Thứ tự: checkout → setup Node → `npm ci` → `ai:setup` → `check` → `docs:check` → `docs:build`.
Một bước lỗi sẽ chặn các bước tiếp theo trong job. Xem check của đúng commit trên PR hoặc tab Actions.

## Quality gates đang có

`npm run check` gọi các nhóm dưới đây theo thứ tự trong `package.json`:

| Nhóm | Lệnh | Phát hiện gì? |
| --- | --- | --- |
| Rules/skills AI | `ai:check`, `test:ai` | Cài đặt local khớp nguồn `.ai/`; installer không tạo file sai |
| Build và kiểu dữ liệu | `build`, `typecheck` | Generate/compile ESM; lỗi TypeScript cả source/spec |
| Ranh giới kiến trúc | `check:architecture` | Import sai layer, dịch vụ vượt qua repository boundary |
| Hợp đồng API | `check:conventions` | Metadata auth/role, request DTO, response/status và SQL không an toàn theo checker |
| Tái sử dụng và nơi đặt file | `check:maintainability` | Sai vị trí, vi phạm boundary và một số khai báo/helper trùng |
| Công cụ dự án | `test:quality`, `test:response-models`, `test:database-tools`, `test:docs` | Regression của checker, generator, công cụ DB và navigation/docs |
| Code style | `lint` | Lỗi theo ESLint hiện tại |
| Hành vi ứng dụng | `test` | Các Vitest suite; DB suite cần opt-in sẽ không tự chạy |
| Artifact chạy được | `test:runtime` | Smoke standalone/Vercel trên loopback với URL giả; không xác nhận DB thật |

Sau `check`, `docs:check` regenerate reference rồi kiểm tra `docs/generated/` không còn thay đổi;
`docs:build` build website và kiểm tra link nội bộ. Reference thay đổi phải commit cùng source tương ứng.

## Rules nằm ở đâu?

- `AGENTS.md` và [core NestJS](../../team/core/index.md): workflow, verification và nguyên tắc chung.
- [Backend Rules](../../guides/backend-rules/index.md): auth/tenant, DTO, query, transaction, event và naming.
- [Persistence](../../development/persistence/persistence-architecture.md): repository, atomic writes và client DB.
- [Testing](../../guides/backend-rules/testing-completion.md): phạm vi và vị trí test.

Sửa policy tại nguồn gốc và checker tại `scripts/quality/` khi cần. Không thêm exemption để vượt qua
lỗi bảo mật, không coi checker là bằng chứng mọi nhánh nghiệp vụ đều đúng.

## CI chưa chứng minh điều gì?

Workflow hiện không tạo PostgreSQL service hoặc cấp URL test thật. URL trong YAML là placeholder;
test transaction/concurrency opt-in không chạy chỉ vì có `DATABASE_URL`. CI xanh không chứng minh
migration đã apply, query plan tối ưu, production đang khỏe hoặc hai request đồng thời luôn đúng.

Chưa có bước kiểm tra image Docker, vulnerability scan riêng hay migration replay trên PostgreSQL thật.
Khi bổ sung, tạo job đúng phạm vi, DB tạm riêng và điều kiện chặn release rõ ràng; không nối vào DB production.

## Chạy gì ở máy dev?

Với mỗi task, chỉ chạy kiểm tra liên quan theo [verification policy](../../team/core/workflow/verification.md).
CI tự động kiểm tra toàn commit ở môi trường sạch; không phải yêu cầu AI chạy lại toàn suite mỗi lần sửa.
Ví dụ sửa navigation/docs thì chạy các test docs liên quan và `docs:build`.

Nếu CI đỏ, làm theo [bảo vệ nhánh và xử lý lỗi](./pull-requests.md). Đừng chạy seed/reset/migration
production để thử sửa một lỗi CI.
