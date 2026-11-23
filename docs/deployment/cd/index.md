# CD: phát hành đúng commit, đúng môi trường

**Dùng khi:** đưa bản đã kiểm tra từ staging lên production hoặc chọn công cụ tự động hóa.
Repository có hai workflow thủ công **Deploy staging / Deploy production**, dùng chung `.github/workflows/deploy-vercel.yml`.
Đọc [thiết lập lần đầu](./github-actions-setup.md) và [cách bấm Deploy](./manual-release.md).
Secrets/environments trên tài khoản cần cấu hình riêng; chưa có bằng chứng deploy staging thành công.

## Vị trí workflow và script

| Vị trí | Trách nhiệm |
| --- | --- |
| `.github/workflows/deploy-staging.yml`, `deploy-production.yml` | Hai điểm chạy thủ công. Chọn môi trường và truyền tùy chọn migration. |
| `.github/workflows/deploy-vercel.yml` | Điều phối GitHub runner, build đầu ra Vercel và phát hành. |
| `scripts/deployment/github-actions/verify-release.mjs` | Xác minh nhánh và CI theo SHA qua GitHub API. Kiểm tra thêm bằng chứng staging khi chính sách của môi trường yêu cầu. |
| `scripts/deployment/vercel/release-policy.json` | Khai báo workflow CI, nhánh phát hành và workflow staging mà production Vercel chấp nhận. |
| `scripts/deployment/vercel/` | Chuẩn bị env tải từ Vercel và kiểm tra OpenAPI trước khi promote với cơ chế bảo vệ của Vercel. |
| `Dockerfile` tại root | Build image của API. Xem [Docker và host Node](../platforms/docker.md). |

GitHub yêu cầu file workflow nằm trực tiếp dưới `.github/workflows/`. Các script hỗ trợ mới
đi theo thư mục của hệ thống mà chúng gọi. Khi có pipeline AWS hoặc Docker, thêm workflow theo
tên đích ở `.github/workflows/` và chỉ tạo thư mục script riêng khi có nhiều file cùng trách nhiệm.
Workflow deploy chọn file chính sách trong repo. Khi thêm đích Docker/AWS, workflow đích có thể gọi
cùng script xác minh với file chính sách riêng và khai báo workflow staging của đích đó.
Vercel dùng nhánh của run đã qua xác minh để chọn Preview env và gắn metadata.
Phiên bản Node lấy từ `.nvmrc`. Action bên thứ ba được ghim theo SHA để khóa phiên bản chạy.

## Một lần phát hành gồm những gì?

| Thứ tự | Trách nhiệm                                                 | Bằng chứng cần có                                                         |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1      | Chọn commit được review, CI pass                            | SHA, link PR và run CI của chính SHA đó                                   |
| 2      | Chuẩn bị môi trường đích                                    | DB, secrets, CORS, runtime Node và domain đúng môi trường                 |
| 3      | Xem thay đổi schema                                         | Migration đã review; tương thích với code đang chạy và phương án quay lui |
| 4      | Build bản phát hành                                         | Artifact/deployment có định danh gắn với commit                           |
| 5      | Apply migration nếu có                                      | Release runner duy nhất, đúng DB; migration không lỗi nếu được chọn              |
| 6      | Deploy bản chưa chuyển domain, smoke rồi promote production | Deployment đúng commit, không bỏ qua CI/approval                          |
| 7      | Kiểm tra sau phát hành                                      | Swagger/assets, API auth/read và logs; ghi nhận kết quả                   |

Build có thể chạy trước migration vì không cần DB thật. Điều bắt buộc là code cần schema mới không
nhận traffic trước khi schema sẵn sàng. Khi code cũ còn chạy, migration phải tương thích với nó.
Với đổi/xóa field, làm nhiều release theo [hướng dẫn thay đổi có dữ liệu](../../database/schema/change-existing-fields.md).

## Chọn một công cụ điều phối CD

| Cách                                         | Phù hợp khi                                                   | Cần cấu hình thêm                                                                          |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Vercel Git + Deployment Checks               | Giữ hosting hiện tại, ít vận hành                             | Required CI checks trước khi gán domain; migration là release step riêng                   |
| GitHub Actions + Vercel CLI/API              | Cần điều phối migration/approval/deploy rõ trong một workflow | Credentials theo environment, gate trước job, CLI khóa phiên bản và điều kiện chỉ đúng SHA |
| GitHub Actions + registry/container platform | Chuyển sang Docker, VM hoặc dịch vụ container                 | Build/push image, khóa digest, release job migration và rollout trên nền tảng đích         |

Chọn **một bên điều phối cho mỗi môi trường**. Nếu Actions chủ động deploy bằng CLI thì phải xử lý
Git auto-deploy tương ứng để tránh hai pipeline phát hành cùng commit. Chưa cần thêm Kubernetes/Argo CD
cho một API nếu chưa có nhu cầu vận hành cụ thể.

## Gate production cần gì?

Workflow bắt buộc ID staging run thành công có cùng Git tree với main; sau khi deploy Production
chưa gán domain, smoke đạt mới promote. Xem [từng nút bấm và kết quả](./manual-release.md).

- CI và review của đúng release commit.
- Người chịu trách nhiệm phát hành; approval dùng GitHub Environment khi gói tài khoản hỗ trợ,
  hoặc quy trình phê duyệt/triển khai thủ công được ghi nhận.
- Giới hạn branch production, quyền secrets tối thiểu và chỉ một release/migration chạy mỗi môi trường tại một thời điểm.
- Migration thất bại thì dừng phát hành; không reset, seed demo hoặc đánh dấu applied khi chưa điều tra.

Workflow hiện dùng environment theo input, concurrency riêng và không tự hủy release đang chạy.
Script xác minh SHA đầu nhánh và CI push trước khi cấp secrets, rồi kiểm tra lại sau build.
Environment branch restrictions và approval phải cấu hình trên GitHub; file YAML không tự bật chúng.
PR/fork không nhận secret phát hành. Giới hạn cạnh tranh với push mới và rollback được mô tả ở
[hướng dẫn chạy](./manual-release.md).

## Migration trong CD dùng lệnh nào? {#migration-commands}

| Môi trường thực thi                         | Lệnh/nguồn cấu hình                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Máy release có file env được chuẩn bị riêng | `db:migrate:apply:staging` hoặc `db:migrate:apply:production`; script bắt buộc đọc file đúng môi trường |
| Job CI/CD được cấp secrets trực tiếp        | `npm run db:migrate:apply`; đọc env của runner qua `prisma.config.ts`, không dựa vào file env local     |

Lệnh generic không tự chọn staging/production. Trước khi chạy, người thiết lập job phải cấp đúng
`DATABASE_URL`/`DIRECT_URL`, kiểm tra đích đã che credential và không checkout/đóng gói env thật.
Runner cần Prisma CLI/dev dependencies; runtime image hiện tại đã prune chúng nên không dùng nó làm migration job.

Dự án dùng **Prisma 7** và `prisma migrate deploy`, được npm script gọi với tên `db:migrate:apply`.
Lệnh áp dụng migration còn thiếu; không tạo Prisma client và không kiểm tra toàn bộ drift.
Xem [Prisma CLI v7](https://docs.prisma.io/docs/cli/v7/migrate/deploy) và
[thứ tự migration](../../database/migrations/order.md), không áp dụng lệnh Prisma major khác chỉ vì docs mới hơn.

## Đi tiếp

1. [Triển khai staging](../environments/staging.md) và kiểm thử bản ứng viên.
2. [Phát hành production](../environments/production.md) sau khi đạt điều kiện.
3. [Thêm/đổi/xóa schema: thứ tự code và DB](../environments/schema-changes.md).
4. [Theo dõi và rollback](./operations.md) bằng thông tin của đúng release.

Nguồn chính thức cho approval/secrets: [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
