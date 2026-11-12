# Sửa docs và rules đúng nguồn

## Thư mục và menu

| Nội dung | Nguồn |
| --- | --- |
| Onboarding, kiến trúc và ví dụ Party | `docs/getting-started/` |
| Các tình huống database | `docs/database/` |
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

- Sửa core trong `.ai/core/`; các trang `docs/team/core/` chỉ include trực tiếp file nguồn.
  Thay nội dung nguồn sẽ cập nhật view khi docs rebuild/dev reload. Không chép policy vào guide khác.
- Sửa DebtFlow rules ngay trong `docs/guides/backend-rules/`; website render chính file đó.
- Sửa skill ở `.ai/skills/` hoặc `.ai/core/skills/`, không sửa bản sinh trong `.codex/`/`.agents/`.
- Sau khi đổi nguồn skill/routing, chạy `npm run ai:setup` rồi `npm run ai:check`.
  Member khác phải nhận thay đổi source và chạy setup; website không tự cập nhật AI trên máy họ.

Khi thêm **core topic mới**, tạo wrapper include tương ứng trong `docs/team/core/` cùng cấu trúc
với `.ai/core/`. Menu quét tên topic tự động; wrapper chỉ là view, không sở hữu nội dung rule.

## Di chuyển một trang

Cập nhật Markdown links, đường dẫn trong `AGENTS.md`, `.ai/project.json`, skill sources và scripts
liên quan; kiểm tra cả link ở dạng code text. Chạy setup nếu thay routing của AI.
`docs/generated/` phải thay từ generator rồi regenerate; không sửa tay hoặc tắt kiểm tra dead links
để che đường dẫn sai. URL theo thư mục file; di chuyển file cũng thay URL trên website.

## Theme UI dùng chung

`docs/.vitepress/theme/docs-theme.css` sở hữu màu, typography và responsive layout.
`SectionIndex` dùng dữ liệu navigation để hiển thị thẻ; `DocIcon` và `DocsPageHeader` dùng chung
cho các khu vực. Giữ search, sidebar, dark mode và copy code của VitePress; không thêm UI library
hoặc viết CSS riêng trong từng trang Markdown. Kiểm tra desktop/mobile và cả light/dark khi đổi theme.
