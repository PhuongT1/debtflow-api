# Sửa docs và rules đúng nguồn

## Thư mục và menu

| Nội dung | Nguồn |
| --- | --- |
| Onboarding, kiến trúc và ví dụ Party | `docs/getting-started/` |
| CI/CD, staging/production và nền tảng deploy | `docs/deployment/` |
| DB dev, DB phát hành, schema và dữ liệu | `docs/database/local/`, `releases/`, `schema/`, `migrations/` và `users/` |
| Guide phát triển theo trách nhiệm | `docs/development/` |
| Thiết lập team/AI và hướng dẫn bảo trì docs | `docs/team/` |
| Quy tắc bắt buộc của DebtFlow | `docs/guides/backend-rules/` |
| Quy tắc NestJS dùng lại giữa dự án | `.ai/core/` |
| Sản phẩm và nghiệp vụ | `docs/reference/` |
| ADR và nguồn tham khảo | `docs/adr/` |
| Reference sinh từ code | `docs/generated/` |

`docs/guides/api-response-format.md` giữ nguyên owner vì đang được source Swagger và generated
reference dẫn tới. Không tạo thêm bản sao trong `development/`.

## Thêm một trang

1. Chọn thư mục theo bảng trên; mỗi trang giải quyết một tình huống/trách nhiệm.
2. Thêm mục vào section tương ứng trong `docs/.vitepress/navigation.mts`.
3. Menu top và sidebar dùng chung khai báo này; các landing page dùng `SectionIndex` cũng đọc từ đó.
4. Cập nhật link từ trang liên quan và chạy `npm run docs:build`.

Topic mới trong `docs/guides/backend-rules/` tự xuất hiện ở menu Rules & AI khi tải lại config/build.
Không thêm nó vào một sidebar toàn cục thứ hai.

## Sửa rule mà không bị lệch bản

- Sửa core trong `.ai/core/`. Một route template `docs/team/core/[topic].md` và loader
  đọc trực tiếp các file nguồn; không tạo wrapper cho từng topic và không chép policy.
- `.ai/project.json.rules` chỉ trỏ tới policy gốc; không đăng ký guide onboarding làm bộ rules thứ hai.
- Sửa DebtFlow rules ngay trong `docs/guides/backend-rules/`; website render chính file đó.
- Sửa skill ở `.ai/skills/` hoặc `.ai/core/skills/`, không sửa bản sinh trong `.codex/`/`.agents/`.
- Sau khi đổi nguồn skill/routing, chạy `npm run ai:setup` rồi `npm run ai:check`.
  Member khác phải nhận thay đổi source và chạy setup; website không tự cập nhật AI trên máy họ.

Khi thêm core topic trong `architecture/`, `backend/` hoặc `workflow/`, menu và route cùng đọc
inventory trong `docs/.vitepress/core-pages.mts`. Dev server theo dõi nguồn core để tải lại;
build tạo trang từ nội dung hiện tại. Thêm file nguồn là đủ, không tạo bản Markdown thứ hai.

Menu cha có thể chỉ là nhóm không có link. Chỉ tạo trang cha khi có nội dung giúp chọn việc cần làm.
Đặt flow và ví dụ dưới kiến trúc; bước kiểm tra migration/user dưới khởi tạo DB. Trang tổng quan
hiển thị cùng cây menu bằng `SectionIndex`/`TopicLinks`, không khai báo lại danh sách thủ công.

Mỗi guide nêu: dùng khi nào, file/lệnh cần thao tác, các bước và dấu hiệu thành công/thất bại.
Policy nằm tại nguồn rule; guide đưa ví dụ và liên kết tới policy. URL hiện tại được giữ khi chỉ
đổi nhóm menu. Kiểm tra link, mục con và trang rules sau khi build.

## Di chuyển một trang

Cập nhật Markdown links, đường dẫn trong `AGENTS.md`, `.ai/project.json`, skill sources và scripts
liên quan; kiểm tra cả link ở dạng code text. Chạy setup nếu thay routing của AI.
`docs/generated/` phải thay từ generator rồi regenerate; không sửa tay hoặc tắt kiểm tra dead links
để che đường dẫn sai. URL mặc định theo thư mục file. Với các guide đã công bố, `pageRewrites` trong
`docs/.vitepress/config.mts` giữ URL cũ khi gom lại source. `source-links.mts` resolve Markdown links
từ file gốc rồi áp dụng cùng rewrite; Git/repository links vẫn trỏ tới file thật.
Không tạo bản sao Markdown chỉ để giữ URL.

## Theme UI dùng chung

`docs/.vitepress/theme/docs-theme.css` sở hữu màu, typography và responsive layout.
`SectionIndex` dùng dữ liệu navigation để hiển thị thẻ; `DocIcon` và `DocsPageHeader` dùng chung
cho các khu vực. Giữ search, sidebar, dark mode và copy code của VitePress; không thêm UI library
hoặc viết CSS riêng trong từng trang Markdown. Kiểm tra desktop/mobile và cả light/dark khi đổi theme.

## Copy chỉ lấy lệnh

Nút copy dùng chung của VitePress bỏ qua chú thích đã được Shiki nhận diện, cho mọi khối code
có syntax highlighting. `docs/.vitepress/code-copy.mts` sở hữu transformer; không viết lại clipboard
riêng cho mỗi trang. Chú thích vẫn hiển thị khi đọc; ký tự `#`, `//`, `--` trong chuỗi và dữ liệu
heredoc được giữ nguyên. Khối `text` không có grammar nên được copy nguyên văn.
Chạy `npm run test:docs` khi sửa copy, navigation hoặc việc đọc nguồn core.

## Tên lệnh npm

Dùng tên theo chức năng thực tế: `db:migrate:dev` tạo/apply migration ở dev,
`db:migrate:apply[:staging|production]` áp dụng lịch sử đã có, `db:migrate:status:*` đọc trạng thái.
DB trống chạy toàn bộ lịch sử; DB đã có bảng chỉ chạy migration còn thiếu. Không gọi thao tác
áp dụng migration là deploy ứng dụng hoặc tạo một lệnh init khác làm cùng việc.
`docs:generate:api` và `docs:generate:database` sinh từng loại reference; `docs:generate` sinh cả hai.
Giữ lệnh framework quen thuộc như `dev`, `start`, `build`, `test`, `lint`; không thêm alias trùng
như `build:prod` khi nội dung build không khác. Khi đổi tên, cập nhật npm callers, CI, docs và rules.

## Hướng dẫn chạy và màu code

`docs/getting-started/running/index.md` giúp chọn tình huống; các trang trong `getting-started/running/`
chỉ mô tả local và xử lý lỗi. CI nằm trong `deployment/ci/`, quy trình phát hành/vận hành trong
`deployment/cd/`, môi trường trong `deployment/environments/` và nền tảng trong `deployment/platforms/`.
Các trang deploy nằm dưới top menu Triển khai; không chép lại workflow hoặc DB runbook thành rules mới.
Không gom lại các quy trình này vào một trang dài.

Code block khai báo đúng grammar: `bash` cho lệnh terminal, `sql` cho SQL, `ts` cho TypeScript,
`json` cho cấu hình, `env` cho biến môi trường và `text` cho output. Chỉ rõ đoạn nào là ví dụ/output
rút gọn. Dẫn tới file owner khi giải thích implementation thật; không trình bày pseudocode như source.
Màu token dùng GitHub High Contrast của Shiki ở cả light/dark, không tô token bằng CSS riêng.
Nhãn ngôn ngữ vẫn hiện khi hover/focus nút copy; đổi theme cần kiểm tra cả hai chế độ.

## Menu và thư mục theo trách nhiệm

| Nhóm menu | File nguồn |
| --- | --- |
| Áp dụng AI: công cụ, skills, cập nhật, tái sử dụng | `docs/team/ai-setup/`; trang cha `ai-setup.md` |
| Chạy local/debug và xử lý lỗi | `docs/getting-started/running/` |
| CI/CD và vận hành release | `docs/deployment/ci/`, `cd/`, `environments/`, `platforms/` |
| Kiến trúc: flow và ví dụ Party | `docs/getting-started/architecture/`; trang cha `architecture.md` |
| DB local: nhận/tạo migration | `docs/database/local/` |
| Kết nối DB với runtime/release runner | `docs/database/releases/` |
| Áp dụng migration: DB mới hoặc đã có lịch sử | `docs/database/migrations/` |
| Tài khoản mẫu, tạo riêng và kiểm tra quyền | `docs/database/users/` |
| Cập nhật schema, baseline và lỗi migration | `docs/database/schema/` |
| Cấu trúc source/imports | `docs/development/source/` |
| HTTP, validation và Swagger | `docs/development/http/` |
| Repository, transaction, filter/sort | `docs/development/persistence/` |

Chỉ nhóm khi có nhiều trang cùng trách nhiệm. Policy canonical và reference sinh từ code giữ nguyên
owner: không chuyển/copy rules vào các thư mục onboarding. Trang `api-response-format.md` giữ owner
trong `guides/` vì được source Swagger và generator dùng; menu HTTP dẫn tới cùng trang đó.
Thư mục guide không yêu cầu module BE phải có tên giống nó; bảng layer/owner trong guide dẫn tới
controller, service, repository và adapter thật của feature.

Checklist phát hành code + DB có một owner: `docs/deployment/environments/production.md`.
Menu Database dẫn tới owner này thay vì sao chép quy trình. Thay đổi field/bảng phải giải thích
thứ tự migration/code và điểm dừng; ghi rõ nơi chạy, env đích và kết quả trước/sau lệnh.
