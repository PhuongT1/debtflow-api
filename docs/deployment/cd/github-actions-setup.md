# Điền cấu hình cho GitHub Actions

**Làm một lần:** lấy 3 giá trị trên **Vercel**, lưu vào **GitHub**. CI không cần thêm secrets;
các giá trị dưới đây dùng cho job `release / deploy` của hai workflow `Deploy staging` và `Deploy production`.

## 1. GitHub: tạo nơi lưu

Mở [repository → Settings → Environments](https://github.com/PhuongT1/debtflow-api/settings/environments).
Bấm **New environment**, nhập `staging` → **Configure environment**. Tạo tiếp `production`.

## 2. Vercel: lấy giá trị

| Name trên GitHub | Dùng để làm gì? | Lấy ở đâu trên Vercel? | Copy giá trị nào? |
| --- | --- | --- | --- |
| `VERCEL_TOKEN` | Cho phép Actions truy cập Vercel | [Account Settings → Tokens](https://vercel.com/account/settings/tokens) → tạo token → chọn scope team chứa project → **Create** | Token vừa tạo |
| `VERCEL_PROJECT_ID` | Chọn project cần deploy | [Project debtflow-api → Settings](https://vercel.com/tran-phuongs-projects/debtflow-api/settings) → **General → Project ID** | Project ID, dạng `prj_...` |
| `VERCEL_ORG_ID` | Chọn team sở hữu project | [Team tran-phuongs-projects → Settings](https://vercel.com/teams/tran-phuongs-projects/settings#team-id) → **General → Team ID** | Team ID |

**Project Settings và Team Settings là hai trang khác nhau.** Copy ID, không dùng tên project/team hoặc domain.
Các liên kết trên trỏ tới team/project trong ảnh bạn cung cấp.

### Chỉ khi Vercel bật bảo vệ deployment

Tại **Vercel → project debtflow-api → Settings → Deployment Protection → Protection Bypass for Automation**,
lấy automation secret. Lưu trên GitHub với Name **`VERCEL_AUTOMATION_BYPASS_SECRET`** theo bước 3.
Deployment không bật bảo vệ thì bỏ qua biến này.

## 3. GitHub: điền giá trị vừa lấy

1. Mở [repository → Settings → Environments](https://github.com/PhuongT1/debtflow-api/settings/environments) → **staging**.
2. Trong **Environment secrets**, bấm **Add environment secret**.
3. **Name:** nhập đúng tên ở bảng bước 2. **Value:** dán giá trị vừa copy từ Vercel → **Add secret**.
4. Lặp lại cho đủ 3 biến. Sau đó mở environment **production** và làm tương tự.

Nếu staging và production cùng project Vercel, có thể dùng cùng token/IDs khi quyền token phù hợp.
**Kết quả:** mỗi environment có 3 secrets bắt buộc; bypass secret chỉ thêm khi cần.

**Bạn đã lưu trong staging:** nút **Deploy staging** dùng ngay 3 secrets đó để deploy nhánh `develop`.
Không cần tạo environment `dev` riêng nếu “dev” của bạn chính là nhánh develop/staging.
Để chạy production, mở environment **production**, lưu cùng 3 tên. Có thể dùng lại giá trị token/IDs
nếu vẫn cùng team/project và token còn quyền; không phải tạo token mới. GitHub không tự chia sẻ
secrets giữa hai environments và không cho xem lại giá trị secret đã lưu.

Ba secrets là **cấu hình một lần**. Nút deploy chỉ còn Branch và ô migration tùy chọn; SHA và bằng chứng
staging được workflow tự kiểm tra. [Cách bấm từng bước](./manual-release.md).

Không điền DB URL, JWT hoặc CORS ở đây. Những biến chạy API được quản lý tại
[cấu hình runtime Vercel](../../database/releases/connect-runtime.md#vercel-runtime).

## Tiếp theo

- [Giới hạn nhánh và quyền duyệt phát hành](../ci/pull-requests.md): staging dùng `develop`, production dùng `main`.
- [Chạy CD từng bước](./manual-release.md): chọn nút staging/production và bấm Run workflow.

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

<SourceCodeViewer title="CD dùng chung — .github/workflows/deploy.yml">

<<< ../../../.github/workflows/deploy.yml{yaml}

</SourceCodeViewer>

## File sử dụng và nguồn tham khảo

| Workflow | File | Job |
| --- | --- | --- |
| CI: `API quality` — không cần secrets thật | `.github/workflows/quality.yml` | `quality` |
| Nút `Deploy staging` | `.github/workflows/deploy-staging.yml` | `release` |
| Nút `Deploy production` | `.github/workflows/deploy-production.yml` | `release` |
| CD dùng chung — nhận secrets của environment tương ứng | `.github/workflows/deploy.yml` | `verify` → `deploy` |

Nguồn chính thức: [Vercel Tokens](https://vercel.com/docs/rest-api/getting-started),
[Project ID](https://vercel.com/docs/project-configuration/general-settings#project-id),
[Team ID](https://vercel.com/docs/accounts#find-your-team-id),
[Automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation),
[GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
