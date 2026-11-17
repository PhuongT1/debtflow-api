# Bấm Deploy: từ staging đến production

**Dùng khi:** [thiết lập GitHub/Vercel](./github-actions-setup.md) đã xong. Trang này mô tả đúng
`.github/workflows/deploy.yml`, không phải các nút tự có của Vercel Git integration.
Push chạy CI; **Run workflow** mới khởi động CD. Không chạy lệnh SQL nào chỉ vì đọc hướng dẫn này.

## 1. Hiểu toàn bộ luồng trước khi bấm

```mermaid
sequenceDiagram
  participant Dev as Người phát hành
  participant GH as GitHub Actions
  participant V as Vercel
  participant DB as PostgreSQL
  Dev->>GH: Merge develop, chờ CI push đạt
  Dev->>GH: Run workflow: staging + SHA
  GH->>GH: Xác minh SHA và CI
  GH->>V: Pull Preview settings/env và build
  GH->>DB: Apply nếu được chọn, luôn kiểm tra migration status
  GH->>V: Deploy Preview
  GH->>V: Smoke Swagger, assets và OpenAPI
  GH-->>Dev: Run staging thành công + URL
  Dev->>Dev: QA tính năng thay đổi, review release
  Dev->>GH: Merge main, chờ CI push đạt
  Dev->>GH: Run workflow: production + SHA + staging run ID
  GH->>GH: Xác minh CI và source tree trùng bản staging đã đạt
  Note over GH: Chờ Environment approval nếu đã cấu hình
  GH->>V: Pull Production settings/env và build --prod
  GH->>GH: Xác minh lại sau thời gian chờ/build
  GH->>DB: Apply nếu được chọn, luôn kiểm tra migration status
  GH->>V: Deploy --prebuilt --prod --skip-domain
  V-->>GH: URL bản mới, chưa chuyển domain production
  GH->>V: Smoke trên chính URL bản mới
  alt Smoke đạt
    GH->>V: Promote chính deployment đã kiểm tra
    V-->>Dev: Domain production chuyển sang bản mới
  else Smoke lỗi
    GH-->>Dev: Dừng; không promote, kiểm tra lỗi
  end
```

**Build** tạo output; **migration apply** thay đổi DB; **deploy** đưa output lên Vercel;
**promote** chuyển domain production. Đây là bốn việc khác nhau.
Bản production chờ promote **vẫn dùng DB/secrets production**; URL riêng không phải sandbox DB.

## 2. Chuẩn bị một lần phát hành

| Việc cần có                                         | Vì sao cần?                                           | Kiểm tra ở đâu?                                     |
| --------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Code + migration được review                        | CI không tự đánh giá SQL có làm mất dữ liệu hay không | PR và `prisma/migrations/*/migration.sql`           |
| CI `API quality` thành công trên commit đầu nhánh   | Tránh phát hành source chưa được kiểm tra             | Actions → API quality, event **push**, SHA đầy đủ   |
| DB đúng môi trường, kế hoạch backup/restore phù hợp | Migration có tác động thật ngay khi apply             | Vercel env + người vận hành DB                      |
| Bản đang tốt và URL/domain đã ghi nhận              | Có đích quay về khi release lỗi                       | Vercel Deployments và release record                |

Nếu `/docs` bị tắt theo chính sách môi trường, cần điều chỉnh
smoke có review trước khi dùng workflow này; không mở public tài liệu chỉ để làm check xanh.

### Chọn `migrations`: lệnh nào ghi DB?

| Chọn              | Điều xảy ra                                                                              | Khi nào dùng?                                                |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `verify` mặc định | Chỉ chạy `prisma migrate status`; pending/failed chặn deploy                             | Không có migration mới hoặc DB đã được cập nhật đúng release |
| `apply`           | **Chạy `prisma migrate deploy`: SQL của mọi migration pending trên DB đích**, rồi status | SQL đã review và tương thích với bản code đang nhận traffic  |

`apply` không chỉ tạo bảng trống: có thể thêm bảng, field, index, constraint hoặc thay đổi/xóa dữ liệu
nếu SQL chứa những thao tác đó. Không có pending thì không chạy lại migration đã applied.
Không sinh migration mới, reset, seed hoặc tự rollback DB. Status kiểm tra lịch sử migration,
**không chứng minh DB hoàn toàn không drift**.

Ví dụ thêm cột nullable: review SQL → apply cột khi code cũ vẫn chạy → deploy code dùng cột.
Rename/DROP/đổi kiểu/NOT NULL/backfill phải có [kế hoạch schema nhiều release](../environments/schema-changes.md).
Workflow không tự phân tích SQL để biết thay đổi có an toàn. Chỉ một runner thực hiện migration;
không vừa apply từ laptop vừa bấm `apply` trong Actions.

## 3. Chạy staging: từng thao tác và kết quả

1. **Merge PR vào `develop`.** Đây là source mà staging sẽ kiểm tra; không chọn feature branch.
2. **Mở Actions → API quality**, tìm run **push** của commit đầu `develop`, chờ tất cả check đạt.
   Copy SHA đầy đủ 40 ký tự từ commit. CI PR có thể chạy trên merge SHA khác nên không thay thế bước này.
3. **Actions → Deploy API → Run workflow.** Chọn:

   | Ô trên màn hình            | Giá trị                          | Lý do                                                     |
   | -------------------------- | -------------------------------- | --------------------------------------------------------- |
   | Use workflow from / Branch | `develop`                        | Chạy workflow từ nhánh staging                            |
   | environment                | `staging`                        | Lấy secrets `staging` và Vercel Preview env của `develop` |
   | sha                        | SHA vừa kiểm tra                 | Khóa source cụ thể, không phát hành mơ hồ “bản mới nhất”  |
   | staging_run_id             | Để trống                         | Chỉ production mới cần bằng chứng staging                 |
   | migrations                 | `verify` hoặc `apply` theo mục 2 | Quyết định có chạy SQL trực tiếp hay không                |

4. **Bấm Run workflow**, mở run vừa tạo. Nếu environment có required reviewer, job sẽ chờ duyệt.
   Người duyệt mở **Review deployments**, kiểm tra environment/SHA/kế hoạch DB rồi mới approve.
   Bấm Run là khởi chạy; approve là cho job nhận secrets và thực thi, nếu chính sách đó đã được bật.
5. **Theo dõi các step** theo bảng mục 5. Kết quả cần thấy: verify xanh, build xanh, migration status
   đạt, deploy có URL và smoke xanh; toàn bộ run có trạng thái **Success**.
6. **Mở URL ở Summary và QA phần thay đổi.** Smoke baseline không kiểm chứng tất cả nghiệp vụ.
   Ghi kết quả QA vào PR/release record, không đưa password/token hoặc dữ liệu riêng tư vào log.
7. **Lưu staging run ID:** trong URL `https://github.com/<owner>/<repo>/actions/runs/123456789`,
   ID là `123456789`, không phải số thứ tự hiển thị của workflow và không phải job ID.

Preview dùng URL trong Summary; workflow chưa tự gán alias staging cố định.

## 4. Chạy production: vì sao cần staging run ID?

1. Chỉ sau staging/QA đạt, tạo PR `develop` → `main`, review rồi merge.
2. Chờ **API quality push của đầu `main`** đạt và copy SHA đầy đủ mới. Merge có thể đổi SHA;
   không lấy SHA develop điền vào production.
3. Mở **Actions → Deploy API → Run workflow**:

   | Ô              | Giá trị                                                                  |
   | -------------- | ------------------------------------------------------------------------ |
   | Branch         | `main`                                                                   |
   | environment    | `production`                                                             |
   | sha            | SHA đầu `main`, CI push đã đạt                                           |
   | staging_run_id | ID run staging thành công ở mục 3                                        |
   | migrations     | `verify` nếu DB đã sẵn sàng; `apply` chỉ khi có kế hoạch SQL tương thích |

4. Bấm **Run workflow**. Verify đối chiếu CI, workflow/branch/repository của staging run và **Git tree**
   của hai commit. Git tree là toàn bộ nội dung file trong commit: cùng source có thể khác SHA do merge.
   Khác nội dung dù chỉ tài liệu/config cũng bị chặn theo chính sách hiện tại; phải đưa đúng source qua staging.
   Gate này chứng minh cùng source đã qua pipeline staging, không chứng minh con người đã QA mọi chức năng.
5. Nếu có approval, người được giao duyệt xem SHA, staging run, QA và migration trước khi approve.
6. Job build bằng env Production, reverify gate, xử lý migration rồi tạo deployment với `--skip-domain`.
   Lúc này domain chính còn trỏ bản cũ; migration đã apply thì **DB đã thay đổi thật**.
7. Smoke kiểm tra URL mới. Đạt thì step **Promote verified production deployment** chạy tự động.
   **Không có nút approve thứ hai giữa smoke và promote trong workflow này.** Nút Run + Environment approval
   trước job là điểm người phát hành cho phép chuỗi hành động chạy.
8. Sau promote, mở **domain production**, kiểm tra API cần thiết và Runtime Logs/metrics.
   Ghi deployment URL, SHA, staging run, migration, người duyệt và kết quả theo [runbook vận hành](./operations.md).

Production build dùng env production riêng, không promote trực tiếp artifact Preview của staging.
Trong chính lần production, output chỉ build một lần; smoke và promote dùng cùng deployment URL.

## 5. Đọc kết quả và xử lý khi một step đỏ

| Step                    | Kết quả cần thấy                                                  | Nếu lỗi thì làm gì?                                                                      |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Verify                  | Đúng branch/workflow SHA, CI đạt; production có staging cùng tree | Kiểm tra đầu nhánh, chờ CI; source khác thì kiểm thử lại staging                         |
| Check credentials       | Đủ secret, không in giá trị                                       | Sửa secret đúng GitHub Environment, không hard-code vào YAML                             |
| Pull                    | Lấy đúng project và Preview/Production env                        | Kiểm tra token, IDs, target và branch-specific env                                       |
| Build                   | Output Vercel được tạo thành công                                 | Xem log build; chưa chạy migration trong lần này                                         |
| Reverify                | Sau thời gian chờ/build vẫn đủ điều kiện                          | Nhánh đã tiến lên thì chạy run mới đúng SHA; không bỏ gate                               |
| Apply, nếu chọn         | Prisma báo hoàn tất hoặc không còn pending                        | Nếu lỗi, dừng và điều tra migration; không reset/resolve tùy tiện                        |
| Migration status        | `Database schema is up to date!` theo Prisma đang dùng            | Pending/failed thì xử lý trước; status không tự sửa schema                               |
| Deploy                  | Có URL bản mới trong Summary                                      | DB có thể đã migrate; không mặc định rollback DB                                         |
| Smoke                   | Swagger, assets và OpenAPI đạt                  | Production chưa promote: domain cũ còn giữ; sửa config/code rồi kiểm tra lại             |
| Promote, chỉ production | CLI báo promote hoàn tất                                          | Timeout không chắc đã hủy promotion; kiểm tra Vercel domain/deployment trước khi thử lại |

Smoke tự động chỉ gọi `/docs`, các Swagger assets cùng origin và `/docs-json`; kiểm tra schema có
route login/Party. Không gửi mật khẩu, JWT hay truy vấn API nghiệp vụ.
**Smoke đạt không chứng minh API login, kết nối DB hoặc phân quyền đúng.** Sau deploy, người kiểm thử
phải [kiểm tra login và quyền truy cập](../../database/users/verify-user-access.md) bằng tài khoản môi trường đó.
Khi chạy staging, hoàn thành bước này trước khi dùng run làm bằng chứng phát hành production.

Nếu smoke lỗi, không có bước promote chạy tiếp. Nếu đã promote rồi mới có sự cố, dùng
[rollback code tương thích schema](./operations.md); workflow không tự rollback code/DB.
Kiểm tra domain production sau promote vẫn là bước của người phát hành, chưa tự động hóa trong YAML.

## 6. Chạy đồng thời, rerun và giới hạn

- Concurrency ngăn hai release **cùng môi trường** chạy đồng thời; không chặn CLI/laptop/pipeline bên ngoài.
  `cancel-in-progress: false` giữ run đang chạy; không coi đây là hàng đợi FIFO giữ mọi lần bấm pending.
- SHA phải bằng commit của workflow run và đầu nhánh lúc verify. Push sau lần verify cuối không được khóa;
  deployment vẫn là SHA đã checkout. Hạn chế push/merge trong cửa sổ phát hành và đọc Summary.
- Không bấm rerun mù quáng khi migration/promotion đã bắt đầu. Kiểm tra DB status và Vercel trước;
  lỗi cleanup hoặc timeout không đồng nghĩa chưa phát hành.
- Secrets/environments/branch protection là cấu hình bên ngoài repo. Người có quyền sửa workflow hoặc
  deploy trực tiếp vẫn có thể thay cơ chế; cần review/bảo vệ workflow và hạn chế quyền Vercel.
- CLI khóa `65.14.0`; build/commands còn phải kiểm chứng trên một lần staging thật trước production.

## 7. Nguồn chính thức và phần dự án lựa chọn

- [Vercel + Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel): pull → build → deploy prebuilt.
- [Vercel deploy](https://vercel.com/docs/cli/deploy#skip-domain), [promote](https://vercel.com/docs/cli/promote): tạo Production deployment chưa gán domain rồi promote.
- [GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs): đọc status/conclusion và commit của run.
- [GitHub Environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments): secrets, branch restrictions và approval.
- [Prisma expand/contract](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern): triển khai schema tương thích theo nhiều giai đoạn.

Đối chiếu Git tree staging/main và input `verify/apply` là **chính sách DebtFlow**,
không phải cơ chế tự động GitHub/Vercel áp đặt. Thay chính sách phải sửa script/test và tài liệu cùng lúc.
