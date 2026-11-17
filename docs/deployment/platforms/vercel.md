# Vercel: môi trường và GitHub Actions

**Dùng khi:** triển khai DebtFlow bằng workflow GitHub Actions thủ công.
Cấu hình đã có trong source; secrets, quyền và domain trên tài khoản phải được maintainer xác nhận.

## 1. Phân chia môi trường

| Git branch | Target khi bấm Deploy API        | Dữ liệu                           |
| ---------- | -------------------------------- | --------------------------------- |
| `develop`  | Preview với env branch `develop` | DB/secrets staging                |
| `main`     | Production                       | DB/secrets production             |
| Nhánh khác | Workflow từ chối                 | Không phát hành bằng workflow này |

Development của Vercel dùng cho local tooling, không đồng nghĩa nhánh `develop`.
Git auto-deploy tắt bởi `git.deploymentEnabled: false` khi cấu hình đã được merge vào nhánh đích.
Deployment hiện có vẫn hoạt động. CLI deploy do Actions gọi vẫn là một đường phát hành riêng.

## 2. Source và dashboard sở hữu gì?

| Owner                                 | Nội dung                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json`                        | Logic build, Node 24 và dependencies                                             |
| Vercel Settings                       | Build Command `npm run build`, runtime env, Production Branch, domain/protection |
| `vercel.json`                         | Tắt Git auto-deploy, function include/duration, redirect và rewrite              |
| `.github/workflows/deploy.yml`        | Nút chạy thủ công, branch/SHA/CI gates, build, DB và deploy                      |
| GitHub Environments                   | Release credentials, giới hạn branch, approval nếu hỗ trợ                        |
| `api/index.js` → `dist/src/vercel.js` | Entrypoint serverless, không chạy `npm start`                                    |

Không xóa rewrite đang phục vụ `/docs`, assets và `/api/*`. Build/start không tự migrate DB;
workflow CD có bước migration riêng do người chạy chọn.
Không upload env thật từ máy dev; runtime dùng biến Vercel của đúng target.

## 3. Thiết lập và phát hành

1. [Thiết lập GitHub Actions + Vercel](../cd/github-actions-setup.md): environments, secrets, branch protection.
2. [Bấm Deploy staging/production](../cd/manual-release.md): inputs, từng bước, kết quả và xử lý lỗi.
3. [Theo dõi và rollback](../cd/operations.md): kiểm tra dữ liệu/API và đường quay lui.

Vercel CI trong dashboard là sản phẩm CI dùng Turborepo, không phải nút bắt buộc cho pipeline này.
Dự án giữ CI trên GitHub Actions để dễ theo dõi toàn bộ check và release.
Nếu sau này quay lại Git auto-deploy + Deployment Checks, đó là thay đổi cơ chế phát hành cần review;
không bật song song để cùng commit bị deploy hai lần.

## 4. Giới hạn phải hiểu

- Workflow build trên runner bằng `vercel build`, deploy bằng `--prebuilt`; cần kiểm chứng một lần staging thực tế.
- Preview từ CLI dùng URL trong Summary; chưa tự cấu hình domain/alias staging cố định.
- Smoke tự động kiểm tra Swagger, assets và OpenAPI; login, quyền truy cập và dữ liệu nghiệp vụ do người kiểm thử xác nhận.
- Production deploy với `--skip-domain`; smoke đạt mới promote. Lỗi trước promote giữ domain cũ, nhưng không rollback migration đã apply.

Nguồn: [Vercel + GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel),
[Vercel CI](https://vercel.com/docs/ci), [Vercel CLI deploy](https://vercel.com/docs/cli/deploy).
