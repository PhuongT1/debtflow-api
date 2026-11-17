# Staging: kiểm tra login và phân quyền của user

Trang con của [Tài khoản dev và kiểm thử](./create-user.md).
**Dùng sau:** [tạo user theo quyền](./create-user.md). Trang này chỉ kiểm tra tài khoản,
không tạo thêm schema hoặc dữ liệu demo.

## 1. Đăng nhập vào đúng API staging

Mở `/docs` của API staging → Auth → `POST /api/auth/login` → Try it out.
Nhập email mẫu và mật khẩu ở [bảng tài khoản](./create-user.md#tai-khoan-co-san).
Với tài khoản tạo riêng, dùng thông tin đã cấp và `organizationId` được giao.
Không đưa password/token vào ticket, Git hoặc ảnh chụp log.

**Kỳ vọng:** HTTP 200, response thành công và context trả về đúng organization/role.
Token được dùng cho các request tiếp theo trong Swagger. Nếu login thất bại, kiểm tra DB của API
có cùng DB đã tạo tài khoản, mật khẩu đã nhập và trạng thái user/membership/organization.

## 2. Kiểm tra quyền bằng endpoint cụ thể

Chọn một bản ghi hoặc fixture đã được cấp cho QA, không thay đổi dữ liệu ngoài kịch bản kiểm thử.

| Kiểm tra | Kết quả cần đối chiếu |
| --- | --- |
| Gọi một API đọc được cho phép, ví dụ list Party | HTTP 200; response thuộc organization đã đăng nhập. |
| User VIEWER gọi thao tác ghi chỉ cho OWNER/ADMIN/ACCOUNTANT | HTTP 403 theo policy của endpoint. |
| Dùng ID của organization khác trong API theo ID | Bị từ chối hoặc không tìm thấy theo contract; không trả dữ liệu tenant khác. |
| User có role được phép, request hợp lệ, fixture đáp ứng điều kiện nghiệp vụ | Thành công theo status của endpoint; điều kiện nghiệp vụ vẫn được kiểm tra. |

Không hiểu ADMIN là được truy cập mọi organization. Xem
[authorization](../../development/authorization.md) và policy cụ thể của endpoint khi viết test case.
Nếu một thao tác hợp lệ về quyền nhưng sai dữ liệu, lỗi validation/nghiệp vụ không phải bằng chứng
role bị cấu hình sai.

## 3. Ghi lại kết quả cho tester khác

Ghi environment/API base URL, email QA, organizationId, role, endpoint và kết quả kỳ vọng/thực tế.
Không ghi mật khẩu hoặc token vào tài liệu chung. Mỗi lần đổi role/thu hồi membership qua API,
kiểm tra lại các tình huống liên quan; không chạy seed để khôi phục quyền.
