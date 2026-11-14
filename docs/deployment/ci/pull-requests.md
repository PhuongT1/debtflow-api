# Bảo vệ nhánh và xử lý CI lỗi

**Dùng khi:** thiết lập điều kiện merge hoặc tìm lý do PR chưa được merge.
Có workflow không đồng nghĩa đã bật bảo vệ nhánh. Những thiết lập dưới đây cần maintainer cấu hình trên GitHub.

## 1. Cấu hình nhánh chính

Trong Repository Settings, dùng Rulesets hoặc Branch protection cho `develop` và `main`:

1. Yêu cầu Pull Request, review trước khi merge; áp dụng cả người có quyền bypass nếu chính sách team yêu cầu.
2. Yêu cầu status check của job `quality` trong workflow `API quality`. Chọn đúng tên check GitHub đã sinh sau một lần chạy; không đoán tên mới trong rule.
3. Yêu cầu branch cập nhật với base branch theo cách team chọn. Nếu sau này dùng merge queue, phải bổ sung trigger `merge_group`; workflow hiện chưa có trigger này.
4. Không cho force push/xóa nhánh phát hành ngoài trường hợp được duyệt.

**Kết quả cần kiểm tra:** PR có CI lỗi hoặc thiếu review không merge được; check gắn với commit mới nhất.
Các chức năng phụ thuộc gói GitHub và loại repository. Xem [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## 2. Khi CI đỏ

| Bước lỗi | Việc cần làm |
| --- | --- |
| `npm ci` | Đối chiếu Node 24 và lockfile; không xóa lock để né lỗi |
| Architecture/conventions | Sửa đúng boundary/contract theo rule được log; không mở rộng baseline |
| Typecheck/test | Mở lỗi đầu tiên và suite liên quan, sửa rồi chạy lại đúng phạm vi |
| `docs:check` | Regenerate reference bằng `npm run docs:generate`; review và commit output cùng source |
| `docs:build` | Sửa đường dẫn hoặc Mermaid ở file owner; không tắt dead-link check |
| Runtime smoke | Kiểm tra entry, ESM aliases/assets và biến giả trong test; không cung cấp secret production |

Push bản sửa lên PR; lần CI mới phải chạy trên commit mới. Chỉ rerun cùng commit khi xác định lỗi hạ tầng
tạm thời, không lặp lại để chờ test flaky tình cờ pass.

## 3. CI pass rồi có deploy chưa?

Không. Check xanh chỉ chứng minh các bước đã cấu hình hoàn tất. Xem deployment của đúng commit bên Vercel
hoặc nền tảng CD; xác nhận môi trường, migration, URL và smoke test theo [quy trình CD](../cd/index.md).
Branch protection chặn merge; nó không tự ngăn một deployment Vercel đã được tạo bởi push.
