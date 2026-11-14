# Vercel: nhánh, env và chặn phát hành

**Dùng khi:** vận hành cách deploy Vercel hiện tại. Cấu hình dashboard phải được maintainer kiểm tra;
tài liệu không xác nhận các gate đã bật trên tài khoản.

## 1. Phân chia môi trường

| Git branch | Vercel environment | Dữ liệu |
| --- | --- | --- |
| `develop` | Preview, dùng làm staging của team | DB và secrets staging |
| `main` | Production Branch | DB và secrets production |
| Nhánh khác | Git auto-deploy tắt trong `vercel.json` | Không có preview tự động theo cấu hình hiện tại |

Development trên Vercel phục vụ local tooling; không đồng nghĩa nhánh `develop`.
Đặt Production Branch là `main` trong cấu hình environment/branch tracking. Preview secrets nên giới hạn
đúng nhánh `develop`; không dùng chung DB production. [Vercel Git](https://vercel.com/docs/git) giải thích mapping này.

## 2. Source và dashboard sở hữu gì?

| Owner | Nội dung |
| --- | --- |
| `package.json` | Logic `npm run build`, Node 24 và dependencies |
| Vercel Settings | Build Command `npm run build`, install settings, secrets, Production Branch, checks |
| `vercel.json` | Cho phép nhánh, function include/duration, redirect và rewrite |
| `api/index.js` → `dist/src/vercel.js` | Entrypoint serverless; không chạy `npm start` |

Không xóa rewrite đang phục vụ `/docs`, assets và `/api/*` để xử lý một cảnh báo cấu hình.
Nếu đổi routing, phải kiểm tra các đường dẫn này cùng nhau. Build/start không tự migrate DB.

Vercel cấp biến runtime theo environment; không upload `.env.staging`/`.env.production`.
Giữ `NODE_ENV` theo runtime được nền tảng hỗ trợ; DB đích được quyết định bởi URL được cấp,
không suy ra từ tên nhánh hay dựa vào fallback file env local.

## 3. Nối CI với việc nhận traffic production

Push có thể tạo deployment ngay khi CI còn chạy. Muốn ngăn bản CI lỗi nhận domain production:

1. Chạy CI ít nhất một lần để check xuất hiện trên commit.
2. Mở Project Settings → Deployment Checks, thêm check GitHub tương ứng job `quality`.
3. Kiểm tra production automatic aliasing và điều kiện của tính năng trên tài khoản hiện tại.
4. Thử bằng commit có check thất bại: deployment có thể được build nhưng không được tự nhận domain production.
5. Check của đúng SHA phải pass trước khi promote; không Force Promote để né lỗi.

Đây là chức năng chặn **promotion/alias**, không phải lời bảo đảm rằng build chưa diễn ra.
Xem [Deployment Checks](https://vercel.com/docs/deployment-checks).
Nếu tài khoản không hỗ trợ gate phù hợp, dùng release thủ công được kiểm soát hoặc pipeline Actions;
không mặc định Git integration đã bảo vệ production.

## 4. Release có migration

Trước khi merge bản cần schema mới, apply migration tương thích từ runner được phép và kiểm tra
trạng thái theo [CD](../cd/index.md). Nếu không thể giữ tương thích, phải có kế hoạch maintenance/cutover
và chặn traffic bản mới cho đến khi DB sẵn sàng. Deployment Checks không tự chạy migration hay approval DB.

## 5. Xác nhận deployment

Đối chiếu branch, commit, environment và build logs. Sau đó kiểm tra `/docs`, `/docs-json`,
Swagger assets và một API đọc được cấp quyền. Deployment Ready chỉ xác nhận build/deploy hoàn tất,
không xác nhận kết nối DB và dữ liệu đúng tenant. Theo dõi/rollback theo [hướng dẫn vận hành](../cd/operations.md).
