# Cấu hình GitHub và Vercel để chạy Deploy API

**Mục tiêu:** lấy đủ giá trị cấu hình, lưu đúng nơi, rồi chạy được workflow **Deploy API**.
Làm lần lượt từ bước 1 đến bước 6. Chưa bấm deploy trong trang này.

::: info Phân biệt hai website
**Vercel** giữ cấu hình chạy API: database, JWT, CORS và project hosting.
**GitHub** giữ cấu hình cho job deploy: token Vercel, project ID và tài khoản kiểm tra API.

**Settings → Environments bên dưới là của repository trên GitHub, không phải Vercel.**
:::

| Cần chuẩn bị                                 | Lưu ở đâu?                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| DB URL, JWT secret, CORS của API             | **Vercel → project `debtflow-api` → Settings → Environment Variables**                 |
| Quyền cho GitHub deploy lên Vercel           | **GitHub → repository `debtflow-api` → Settings → Environments → Environment secrets** |
| Tài khoản để workflow thử login và đọc Party | Tạo trong **DB đích**; lưu thông tin đăng nhập vào **GitHub Environment secrets**      |

Cần quyền sửa cấu hình project trên Vercel và quyền quản lý environments của repository GitHub.

## 1. Vercel: đặt cấu hình chạy API cho từng môi trường

**Website: `vercel.com`.** Mở team đang chứa project → **`debtflow-api` → Settings**.

### 1.1. Kiểm tra build

Trong **Build and Deployment**, kiểm tra Build Command là `npm run build` và Node.js là `24.x`.
Trong cấu hình Git/Production Branch, kiểm tra nhánh production là `main`.
Giữ routing hiện có của API và Swagger.

**Kết quả:** Vercel biết cách build API; bước này chưa build hoặc deploy.

### 1.2. Điền Environment Variables

Mở **Settings → Environment Variables**. Thêm hoặc sửa các biến dưới đây, chọn đúng phạm vi rồi **Save**:

| Tên biến       | Giá trị lấy ở đâu?                                                         | Preview, branch `develop` | Production            |
| -------------- | -------------------------------------------------------------------------- | ------------------------- | --------------------- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL của nhà cung cấp DB                               | URL DB staging            | URL DB production     |
| `DIRECT_URL`   | Kết nối direct của **cùng DB**; nếu không có endpoint riêng, dùng cùng URL | Direct URL staging        | Direct URL production |
| `JWT_SECRET`   | Secret riêng do người quản lý môi trường tạo/cấp                           | Secret staging            | Secret production     |
| `CORS_ORIGIN`  | URL frontend được phép gọi API                                             | URL FE staging            | URL FE production     |

Các biến khác dùng giá trị theo [hướng dẫn kết nối runtime](../../database/releases/connect-runtime.md)
và template `.env.production.example`; không tự đặt giá trị giả để vượt qua validation.
Với Preview, chọn branch `develop` để workflow lấy đúng cấu hình staging.
**File `.env.staging` trên laptop không tự được đưa lên Vercel.**

**Kết quả:** cấu hình Preview/develop trỏ DB staging; Production trỏ DB production.
GitHub sẽ lấy các giá trị này bằng Vercel CLI, không cần nhập lại DB URL vào GitHub Secrets.
Connection dùng migration phải có quyền chạy SQL thay đổi schema. Nếu tách tài khoản DB runtime và
migration, cần điều chỉnh thiết kế runner/quyền riêng trước khi dùng; workflow hiện lấy cấu hình từ Vercel.

## 2. Vercel: lấy token và hai ID cho GitHub

Ba giá trị ở bước này dùng để GitHub chọn đúng project và có quyền deploy. Chưa lưu chúng vào source.

### 2.1. Lấy `VERCEL_TOKEN`

**Website: Vercel, phần tài khoản cá nhân**, không phải Settings của repository GitHub.

1. Mở **[Vercel Account Tokens](https://vercel.com/account/settings/tokens)**.
2. Tạo token, ví dụ đặt tên `debtflow-github-actions`.
3. Chọn scope có quyền truy cập project `debtflow-api` trong đúng team và thời hạn phù hợp.
4. Bấm **Create**, copy token được hiển thị. Giá trị này sẽ lưu dưới tên **`VERCEL_TOKEN`** ở bước 5.

**Kết quả:** có token Vercel. Token này khác JWT token mà user dùng để gọi API.
Nếu token hết hạn hoặc bị thu hồi, phải cập nhật secret trên GitHub.

### 2.2. Lấy `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID`

Tại **Terminal trên máy dev**, đứng ở thư mục `debtflow-api`, chạy:

```bash
npx vercel@65.14.0 login
npx vercel@65.14.0 link
```

- `login`: đăng nhập tài khoản Vercel có quyền với project.
- `link`: chọn **đúng team đang sở hữu project**, rồi liên kết với project **`debtflow-api` đã có**.
  Nếu CLI hỏi liên kết existing project, chọn existing project; không tạo project mới.
- Hai lệnh này không deploy API, không chạy migration. `npx` có thể tải CLI nếu máy chưa có.

Mở file local **`.vercel/project.json`** vừa được tạo:

```json
{
  "orgId": "team_REPLACE_WITH_REAL_ID",
  "projectId": "prj_REPLACE_WITH_REAL_ID"
}
```

Đây là ví dụ tên trường, không phải ID thật để copy.

| Trong file local    | Tên sẽ lưu trên GitHub |
| ------------------- | ---------------------- |
| Giá trị `orgId`     | `VERCEL_ORG_ID`        |
| Giá trị `projectId` | `VERCEL_PROJECT_ID`    |

**Kết quả:** có hai ID của đúng project. `.vercel/` là cấu hình local đã ignore, không commit.
Nếu hai môi trường dùng chung project Vercel, hai ID có thể giống nhau; DB/env vẫn phải tách ở bước 1.

## 3. DB đích: chuẩn bị tài khoản kiểm tra API

Workflow cần tài khoản để xác nhận API mới thực sự login và đọc được DB.
**Đây là user của DebtFlow, không phải tài khoản GitHub/Vercel.**

1. DB staging/production phải có schema trước khi tạo user. Xem [áp dụng migration](../../database/migrations/index.md).
2. Chuẩn bị file env local trỏ đúng DB cần tạo tài khoản.
3. Chạy **một** lệnh tương ứng tại Terminal:

   **Tạo tài khoản staging:**

   ```bash
   npm run db:user:create:staging
   ```

   **Tạo tài khoản production:**

   ```bash
   npm run db:user:create:production
   ```

4. Chọn role **`VIEWER`**, nhập email riêng và mật khẩu riêng theo hướng dẫn Terminal.
   Các lệnh này **ghi user/membership vào DB thật**; chỉ chạy khi được giao quyền tạo tài khoản môi trường đó.
5. Lưu lại email, mật khẩu vừa nhập và `organizationId` trong kết quả Terminal.
   Không dùng `userId` thay cho `organizationId`.

| Giá trị vừa có                  | Tên sẽ lưu trên GitHub       |
| ------------------------------- | ---------------------------- |
| Email đăng nhập                 | `SMOKE_TEST_EMAIL`           |
| Mật khẩu của user               | `SMOKE_TEST_PASSWORD`        |
| `organizationId` của membership | `SMOKE_TEST_ORGANIZATION_ID` |

**Kết quả:** mỗi DB có user kiểm tra riêng, user/membership/organization đều active.
Nếu đã có user phù hợp, tái sử dụng; không cần tạo lại. Chi tiết tại [tạo user](../../database/users/create-user.md).
Không seed bộ user mật khẩu mẫu vào production.

## 4. Vercel: lấy bypass secret nếu deployment được bảo vệ

**Website: Vercel → project `debtflow-api` → Settings → Deployment Protection.**

Nếu URL deployment yêu cầu đăng nhập Vercel, workflow không thể tự mở trang đó như trình duyệt đã login:

1. Tìm **Protection Bypass for Automation**.
2. Tạo hoặc copy automation secret theo tùy chọn Vercel cung cấp.
3. Giữ giá trị này để lưu dưới tên **`VERCEL_AUTOMATION_BYPASS_SECRET`** ở bước 5.

**Kết quả:** smoke test có thể đi qua lớp bảo vệ hosting. Secret này không thay JWT của DebtFlow;
workflow vẫn phải login bằng user ở bước 3. Nếu deployment không bật bảo vệ, không cần thêm secret này.

## 5. GitHub: tạo môi trường và lưu các giá trị vừa lấy

**Website: `github.com`.** Mở repository **`PhuongT1/debtflow-api`**, không mở trang project Vercel.
Có thể vào thẳng **[GitHub repository → Settings → Environments](https://github.com/PhuongT1/debtflow-api/settings/environments)**.

### 5.1. Tạo hai environment

1. Bấm **New environment**, nhập chính xác `staging`, bấm **Configure environment**.
2. Quay lại danh sách, tạo tiếp `production`.

**Kết quả:** GitHub có hai environment tên khớp với input của workflow.
Nếu không thấy Environments hoặc required reviewers, kiểm tra quyền quản trị và khả năng hỗ trợ của gói GitHub/visibility repository.

### 5.2. Thêm secrets vào từng environment

Mở **`staging` → Environment secrets → Add environment secret**.
Nhập **Name** theo bảng, **Value** lấy từ các bước trước, rồi **Add secret**. Lặp lại cho từng dòng:

| Name trên GitHub                  | Value lấy ở bước nào?                        | Bắt buộc?           |
| --------------------------------- | -------------------------------------------- | ------------------- |
| `VERCEL_TOKEN`                    | Bước 2.1: token tài khoản Vercel             | Có                  |
| `VERCEL_ORG_ID`                   | Bước 2.2: `orgId`                            | Có                  |
| `VERCEL_PROJECT_ID`               | Bước 2.2: `projectId`                        | Có                  |
| `SMOKE_TEST_EMAIL`                | Bước 3: email user trong **DB staging**      | Có                  |
| `SMOKE_TEST_PASSWORD`             | Bước 3: mật khẩu user staging                | Có                  |
| `SMOKE_TEST_ORGANIZATION_ID`      | Bước 3: organization ID của user staging     | Có                  |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bước 4: automation secret của project Vercel | Khi URL được bảo vệ |

Tiếp theo mở **GitHub environment `production`**, thêm cùng các **Name** nhưng Value của user/DB
production. Nếu chung project Vercel, token/IDs/bypass có thể dùng chung theo quyền đã cấp.

**Kết quả:** mỗi environment có đủ tên secret, giá trị được GitHub che.
Không điền chúng vào **Vercel Environment Variables**: bảng này dành cho **GitHub Environment secrets**.
`github.token` được GitHub cấp tự động cho workflow; bạn không cần tạo secret `GH_TOKEN`.

### 5.3. Giới hạn nhánh và người duyệt trên GitHub

Trong từng **GitHub environment → Deployment branches and tags**, đặt nhánh được phép:

| GitHub environment | Nhánh được phép |
| ------------------ | --------------- |
| `staging`          | `develop`       |
| `production`       | `main`          |

Trong environment **`production` → Deployment protection rules**, cấu hình **Required reviewers**
và **Prevent self-review** nếu gói GitHub hỗ trợ. Khi chạy CD, người được chỉ định duyệt trước khi job nhận secrets.
Không có reviewer rule thì bấm Run workflow là chạy thủ công, không có approval độc lập tự sinh.

## 6. GitHub: kiểm tra đã sẵn sàng chạy chưa

1. Workflow đã được merge qua PR vào default branch và có trên `develop`/`main` để dùng.
   Cấu hình tắt Git auto-deploy cũng phải có trên các nhánh tương ứng.
2. **GitHub → repository → Actions** hiển thị `API quality` và `Deploy API`.
3. `API quality` của commit push đầu `develop` đạt. Bảo vệ merge `develop`/`main` bằng PR/review/check
   `quality` tại **GitHub repository → Settings → Rules/Branches**, theo quyền/gói đang có.
4. Đối chiếu lần cuối: Vercel Preview/develop dùng DB staging; GitHub environment staging có user của DB đó.
5. Mở **[Bấm Deploy staging từng bước](./manual-release.md)**.

**Kết quả mong đợi:** chọn được `develop` + `staging`, verify đạt, build/deploy/smoke đạt và Summary có URL.
Có file YAML hoặc đủ tên secrets chưa chứng minh quyền/giá trị đúng; cần một lần staging thật thành công.
Trang này không tự thay đổi tài khoản GitHub/Vercel, deploy hay chạy DB.

## Nguồn cấu hình và tài liệu tham khảo

### File thực thi trong repository

| File                                    | Vai trò                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| `.github/workflows/quality.yml`         | CI khi push/PR                                            |
| `.github/workflows/deploy.yml`          | Các input, secrets và step của Deploy API                 |
| `scripts/deployment/verify-release.mjs` | Gate SHA/CI và bằng chứng staging                         |
| `scripts/deployment/smoke.mjs`          | Kiểm tra Swagger/login/auth/Party                         |
| `vercel.json`                           | Tắt Git auto-deploy và giữ routing                        |
| `.env.production.example`               | Template biến môi trường API, không chứa credentials thật |

### Tài liệu chính thức

- [Vercel: token và scope](https://vercel.com/docs/rest-api/getting-started).
- [Vercel: GitHub Actions và project IDs](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).
- [Vercel: Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
- [GitHub: tạo và bảo vệ environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
- [GitHub: điều kiện hiển thị Run workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Không cần bật sản phẩm **Vercel CI** cho quy trình này; CI và nút chạy CD ở **GitHub Actions**.
