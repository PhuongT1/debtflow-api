# Trình tự deploy

**Trước khi chạy:** hoàn tất [cấu hình GitHub Actions và Vercel](./github-actions-setup.md).

Mở **GitHub → Actions → Deploy staging → Run workflow**, chọn `develop`.
Để trống ô migration nếu chỉ phát hành code. Tick ô khi đã review và muốn chạy toàn bộ
migration còn chờ trên DB staging. Production dùng workflow riêng và nhánh `main`.
Sau khi chạy, mở **Summary → release / verify** rồi **release / deploy**.

## 1. GitHub xác minh bản phát hành

1. **Run workflow** đọc `.github/workflows/deploy-staging.yml` hoặc `deploy-production.yml`.
   File này nhận ô `apply_migrations` (mặc định tắt) và gọi workflow dùng chung `deploy-vercel.yml`
   tại commit của lần chạy. Mở **Workflow file** để xem phiên bản đã dùng.
2. **Verify branch and exact commit CI** chạy `scripts/deployment/github-actions/verify-release.mjs`
   với `scripts/deployment/vercel/release-policy.json`.
   Script kiểm tra SHA được chọn còn là đầu nhánh và lần CI push mới nhất của đúng SHA đã thành công.
   Production đối chiếu cây mã nguồn với lần deploy Vercel staging thành công theo chính sách này.
   Kết quả và link CI nằm trong Summary. Job deploy chỉ bắt đầu khi job verify thành công.

## 2. GitHub runner chuẩn bị và build

| Thứ tự | Bước trong log | Đọc gì, tạo gì |
| --- | --- | --- |
| 3 | **Set up job → Set runner database env file path** | Runner Ubuntu chuẩn bị job. Workflow ghi đường dẫn `$RUNNER_TEMP/debtflow-release-db.env` vào `$GITHUB_ENV` để các bước sau dùng. Lúc này mới có đường dẫn. |
| 4 | **Checkout → Setup Node → Check credentials** | Checkout đúng `github.sha`, dùng Node 24 và cache npm. Kiểm tra ba biến Vercel từ GitHub Environment đích. Kiểm tra quyền và project thực tế diễn ra khi CLI gọi Vercel. |
| 5 | **Run npm ci → Install pinned Vercel CLI** | `npm ci` cài dependency theo `package-lock.json`. Vercel CLI được cài riêng theo phiên bản khóa trong `deploy-vercel.yml`. |
| 6 | **Pull target settings and environment** | `vercel pull --environment=preview --git-branch=develop` lấy cấu hình project và env có thể tải cho staging, lưu env vào `.vercel/.env.preview.local`. Production dùng `--environment=production` và `.vercel/.env.production.local`. Bước này chưa tạo deployment. |
| 7 | **Prepare database environment for the release runner** | `scripts/deployment/vercel/prepare-environment.mjs` đọc env vừa tải, ưu tiên DB secrets GitHub nếu có, kiểm tra URL và ghi file tạm quyền `0600`. Workflow yêu cầu `DIRECT_URL` rõ ràng khi bật migration. |
| 8 | **Build Vercel output** | Node nạp file env Vercel rồi file DB tạm. `vercel build` chạy trên GitHub runner và tạo `.vercel/output`. Production thêm `--prod`. |
| 9 | **Verify release again after waiting and building** | Chạy lại script với cùng file chính sách trước khi ghi DB hoặc upload, vì đầu nhánh hoặc trạng thái CI có thể đổi trong lúc chờ và build. |

Trong bước 8, Build Command dùng `npm run build` theo cấu hình project Vercel. Script trong
`package.json` sinh Prisma Client và metadata từ `prisma.config.ts` và thư mục `prisma/`,
compile NestJS vào `dist/`, rồi rewrite import aliases. Vercel CLI đóng gói runtime theo
`vercel.json`. File `api/index.js` trỏ tới `dist/src/vercel.js`.
`dist/` là đầu ra NestJS. `.vercel/output` là đầu ra để upload bằng `--prebuilt`.

## 3. Migration, upload và chuyển domain

10. **Apply reviewed migrations → Check database migration status** chỉ chạy khi tick ô migration.
    GitHub gọi Prisma CLI trực tiếp với hai file env. `migrate deploy` áp dụng SQL còn chờ trong
    `prisma/migrations/`, rồi `migrate status` đối chiếu lịch sử trong DB. `prisma.config.ts`
    đặt URL CLI từ `DIRECT_URL`. API chạy trên Vercel dùng `DATABASE_URL` từ môi trường runtime.
    Khi để trống ô, cả hai bước hiện **Skipped**. Nếu apply hoặc status lỗi, job dừng trước upload.
11. **Deploy the built output** chạy `vercel deploy --prebuilt` để gửi `.vercel/output` lên Vercel.
    Staging tạo bản **Preview** gắn metadata nhánh `develop`. Production dùng
    `--prod --skip-domain` để tạo deployment trước khi chuyển domain production.
    CLI trả URL và workflow ghi URL đó vào **Summary → Deployment**. Staging hoàn tất sau khi
    Vercel báo sẵn sàng. Vercel dùng cấu hình runtime của môi trường đích để chạy API.
12. **Check OpenAPI before production promotion → Promote verified production deployment**
    chỉ chạy trên production. `scripts/deployment/vercel/smoke.mjs` đọc `/docs-json` và kiểm tra
    các route cần có. Khi đạt, `vercel promote` chuyển domain production sang chính deployment
    vừa kiểm tra. Nếu kiểm tra lỗi, deployment vẫn có thể hiện **Ready**, nhưng chưa được promote.
13. **Remove downloaded environment files** dọn các file env tạm dù job thành công hay thất bại.
    Các bước **Post Run** và **Complete job** là phần kết thúc do GitHub Actions ghi log.

Xem tiếp [Kết quả và log](./deployment-results.md) để đối chiếu lần chạy với deployment.

## Xem GitHub Actions ngay tại đây

Nội dung bên dưới được lấy trực tiếp từ file YAML gốc khi chạy/build tài liệu, không có bản sao để sửa riêng.

<SourceCodeViewer title="CI — .github/workflows/quality.yml">

<<< ../../../.github/workflows/quality.yml{yaml}

</SourceCodeViewer>

<SourceCodeViewer title="Deploy staging — .github/workflows/deploy-staging.yml">

<<< ../../../.github/workflows/deploy-staging.yml{yaml}

</SourceCodeViewer>

<SourceCodeViewer title="Deploy production — .github/workflows/deploy-production.yml">

<<< ../../../.github/workflows/deploy-production.yml{yaml}

</SourceCodeViewer>

<SourceCodeViewer title="CD dùng chung — .github/workflows/deploy-vercel.yml">

<<< ../../../.github/workflows/deploy-vercel.yml{yaml}

</SourceCodeViewer>
