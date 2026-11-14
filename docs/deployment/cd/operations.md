# Kiểm tra sau deploy, theo dõi và rollback

**Dùng khi:** bản mới vừa được triển khai hoặc production phát sinh lỗi. Ghi lại commit, deployment ID,
thời điểm và người phát hành để truy vết đúng bản.

## 1. Smoke test bản vừa phát hành

| Kiểm tra | Kết quả mong đợi |
| --- | --- |
| URL `/docs`, `/docs-json` và Swagger assets | Trang/schema tải được, không lỗi route hoặc asset |
| API bảo vệ không có token | Bị từ chối đúng hợp đồng, không lộ dữ liệu |
| Login và API list bằng tài khoản kiểm tra được cấp | Thành công với đúng tenant, đúng quyền và pagination |
| Kết nối DB và trạng thái migration | API đọc được DB đúng môi trường; không có migration thất bại/chưa apply của release |
| Thời gian phản hồi và logs | Không tăng lỗi 5xx, timeout hoặc lỗi kết nối so với trước release |

Chỉ mở Swagger chưa kiểm chứng DB. Không chạy seed hoặc tạo giao dịch thật để smoke test production
nếu chưa có kịch bản được phép. Không gửi password/token/DB URL trong ảnh hoặc release log.

## 2. Xem lỗi ở đâu?

| Triệu chứng | Nơi xem |
| --- | --- |
| CI fail trước deploy | GitHub Actions → workflow/run/step lỗi của commit |
| Không build được | Vercel Build Logs hoặc log job build image |
| API 5xx/timeout lúc chạy | Vercel Runtime Logs hoặc stdout/stderr của container/process |
| Query chậm, hết connection | Metric/log PostgreSQL và log runtime liên quan; không chỉ build log |
| Sai dữ liệu nghiệp vụ | Request đã che thông tin nhạy cảm, user/tenant được phép và truy vấn đối chiếu DB chỉ đọc |

Repository chưa cài một hệ thống APM/alert CD riêng. Nền tảng vận hành cần cấu hình cảnh báo lỗi,
độ trễ và tài nguyên DB; đừng coi ví dụ trong tài liệu là dashboard đã tồn tại.

## 3. Nếu cần rollback

1. Xác định bản cuối đang tốt và schema DB hiện tại.
2. Nếu code cũ tương thích schema hiện tại, dùng rollback/redeploy của nền tảng hoặc rollout image digest cũ.
3. Kiểm tra lại smoke test và logs; ghi nhận deployment thay thế.
4. Nếu schema không tương thích code cũ, dừng rollback máy móc; chọn forward fix hoặc phương án khôi phục đã được người vận hành duyệt.

Rollback deployment **không rollback DB**. Không xóa lịch sử migration hoặc chạy reset trên production.
Khôi phục backup có thể mất dữ liệu phát sinh sau backup và cần kế hoạch riêng. Xem
[migration lỗi/drift](../../database/schema/migration-failure.md).

Trên Vercel, xem [Instant Rollback](https://vercel.com/docs/instant-rollback) và xác nhận bản khôi phục
có cấu hình runtime phù hợp. Với container, dùng image digest đã ghi trong release, tránh tag `latest` không xác định.

## 4. Ghi nhận kết thúc release

Lưu SHA, CI run, migration đã apply, deployment/image digest, người duyệt, URL, kết quả smoke và
phương án rollback trong PR/release record. Khi có lỗi, bổ sung regression test ở đúng owner và cập nhật
runbook nếu các bước xử lý đã thay đổi; không sửa một bản rules sao chép ở đây.
