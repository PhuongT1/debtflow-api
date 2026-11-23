# Bấm Deploy staging hoặc production

**Cấu hình một lần:** [lưu 3 secrets GitHub](./github-actions-setup.md). Khi deploy, không nhập lại token,
SHA hoặc staging run ID. Workflow tự lấy commit của nhánh bạn chọn và kiểm tra CI của đúng commit đó.

## 1. Hai lựa chọn trên GitHub Actions

| Chọn trong Actions | Branch trong Run workflow | GitHub Environment | Vercel |
| --- | --- | --- | --- |
| **Deploy staging** | `develop` | `staging` | Preview, cấu hình của `develop` |
| **Deploy production** | `main` | `production` | Production |

Trong dự án này, “deploy dev/develop” nghĩa là deploy nhánh `develop` lên staging.
Chạy local bằng `npm run dev` không cần Vercel hoặc GitHub secrets.

Hai workflow dùng chung `.github/workflows/deploy-vercel.yml`, tránh lặp các bước build/deploy.
Để hiện nút Run workflow, các file workflow phải có trên **default branch** của repository.
Merge các file này không tự deploy vì chỉ có trigger thủ công `workflow_dispatch`.

## 2. Deploy staging: từng bước

1. Merge PR vào **develop**.
2. Mở **GitHub → repository debtflow-api → Actions → API quality**. Chờ run **push** của đầu nhánh
   develop thành công. CI của PR không thay thế CI push này.
3. Mở **Actions → Deploy staging → Run workflow**.
4. Trong **Use workflow from**, chọn **develop**.
5. Giữ **Apply all pending database migrations…** không chọn nếu chỉ phát hành code. Chỉ chọn khi muốn
   chạy SQL migration đã review lên DB staging, theo mục 4.
6. Bấm **Run workflow**. Mở run vừa tạo để xem các job `release / verify` và `release / deploy`.
7. Khi run **Success**, mở URL trong **Summary** để kiểm tra login và tính năng thay đổi.

**Tự động:** khóa SHA của run → xác nhận vẫn là đầu develop → xác nhận CI push đạt → tải cấu hình
Vercel Preview/develop → build → kiểm tra lại gate → migration tùy chọn → deploy. Sau khi job thành công, kiểm tra Swagger/OpenAPI qua URL trong Summary.

**Kết quả:** Summary có SHA, liên kết CI và deployment URL. Không cần tìm hoặc nhập staging run ID.
Preview hiện dùng URL trong Summary; chưa có alias staging cố định do workflow này tạo.

## 3. Deploy production: từng bước

1. Hoàn thành staging và QA trước; review PR **develop → main**, rồi merge.
2. Chờ **API quality** của commit đầu **main**, event **push**, thành công.
3. Mở **Actions → Deploy production → Run workflow → Use workflow from: main**.
4. Giữ ô migration không chọn nếu DB production đã sẵn sàng; chỉ chọn sau khi review SQL và kế hoạch DB.
5. Bấm **Run workflow**. Nếu GitHub Environment có required reviewers, người duyệt mở
   **Review deployments**, kiểm tra SHA, staging/QA và migration rồi approve.
6. Workflow tự tìm **lần Deploy staging thành công mới nhất trong 100 run gần nhất**, xác minh đúng
   workflow/repository/branch và nội dung source trùng main. Không có hoặc khác source thì dừng.
7. Build bằng cấu hình Production → kiểm tra gate lại → migration tùy chọn → deploy với `--skip-domain`.
   OpenAPI đạt thì tự promote chính deployment đó sang domain production.
8. Mở domain production, kiểm tra login/API liên quan và **Vercel → project → Logs**.

**Kết quả:** Summary ghi commit, CI, staging run được chọn và deployment URL.
Cùng nội dung source có thể khác commit SHA sau merge; workflow so sánh **Git tree**.
Nếu main có thay đổi khác staging, đưa đúng source qua staging trước. Không bỏ gate để deploy.

Production dùng secrets của **GitHub Environment production**, không đọc secrets trong staging.
Có thể lưu lại **cùng giá trị token Vercel** nếu token có quyền; không bắt tạo token mới.

## 4. Ô migration làm gì?

| Ô Apply all pending database migrations | Hành vi trước khi deploy |
| --- | --- |
| Tắt (mặc định) | Bỏ qua áp dụng và kiểm tra migration |
| Bật | Chạy `prisma migrate deploy` để áp dụng tất cả migration còn chờ, sau đó chạy `prisma migrate status` để xác minh. Nếu một bước thất bại, deploy dừng |

Apply chạy SQL của **mọi migration còn pending**: có thể tạo bảng, thêm field/index hoặc xóa/đổi dữ liệu
nếu SQL chứa thao tác đó. Không có pending thì không chạy lại migration đã applied.
Workflow không sinh migration mới, reset hoặc seed dữ liệu.

Trước khi chọn apply: review SQL, xác nhận đúng DB, chuẩn bị backup/restore và bảo đảm SQL tương thích
với code đang chạy. Rename/DROP/NOT NULL/backfill cần [kế hoạch nhiều release](../environments/schema-changes.md).
Chỉ dùng một migration runner; không đồng thời apply từ laptop và GitHub Actions.

## 5. Khi bị chặn hoặc thất bại

| Step | Cần thấy / cách xử lý |
| --- | --- |
| Verify | Chọn đúng develop/main, CI push đạt. Nhánh đã tiến lên thì chạy run mới |
| Staging evidence, production | Deploy staging thành công với cùng source; hoàn thành QA trước production |
| Check credentials | 3 secrets nằm đúng GitHub Environment; không dán token vào input/log |
| Pull / Build | Xác nhận token/IDs và runtime env trên Vercel, xem log lỗi |
| Migration status | `Database schema is up to date!`; pending thì review/apply, failed thì điều tra |
| Smoke | `/docs`, assets cùng origin, `/docs-json` và schema route login/Party hoạt động |
| Promote | Chỉ production; sau khi đạt, kiểm tra domain thật và Runtime Logs |

Smoke không thử login, DB read hay phân quyền. Người kiểm thử làm [kiểm tra login và quyền](../../database/users/verify-user-access.md).
Nếu lỗi trước promote, domain production cũ còn giữ; migration đã apply vẫn thay đổi DB thật.
Không có nút approve thứ hai giữa smoke và promote. Xem [rollback và vận hành](./operations.md).

Concurrency chỉ giới hạn các release cùng môi trường trong workflow này. Không khóa người chạy CLI ngoài.
Không rerun mù quáng sau lỗi migration/promotion; kiểm tra DB và Vercel trước.
CLI được khóa phiên bản; vẫn cần một lần staging thực tế để xác nhận cấu hình tài khoản hoạt động.

## Nguồn và file gốc

- Nút staging: `.github/workflows/deploy-staging.yml`; production: `.github/workflows/deploy-production.yml`.
- Xử lý chung: `.github/workflows/deploy-vercel.yml`; gate: `scripts/deployment/github-actions/verify-release.mjs`.
- [Xem YAML trong modal](./deployment-sequence.md#xem-github-actions-ngay-tai-day).
- [GitHub: chạy workflow thủ công](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
  [tái sử dụng workflow](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).
- [Vercel với GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel),
  [deploy skip-domain](https://vercel.com/docs/cli/deploy#skip-domain), [promote](https://vercel.com/docs/cli/promote).

Gate đầu nhánh/CI, cùng source staging và ô migration là chính sách DebtFlow được thực thi trong source.
