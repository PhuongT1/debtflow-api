# CD: phát hành đúng commit, đúng môi trường

**Dùng khi:** đưa bản đã kiểm tra từ staging lên production hoặc chọn công cụ tự động hóa.
Repository chưa có job CD đầy đủ; bên dưới là quy trình cần thực hiện/cấu hình, không phải pipeline đã bật.

## Một lần phát hành gồm những gì?

| Thứ tự | Trách nhiệm | Bằng chứng cần có |
| --- | --- | --- |
| 1 | Chọn commit được review, CI pass | SHA, link PR và run CI của chính SHA đó |
| 2 | Chuẩn bị môi trường đích | DB, secrets, CORS, runtime Node và domain đúng môi trường |
| 3 | Xem thay đổi schema | Migration đã review; tương thích với code đang chạy và phương án quay lui |
| 4 | Build bản phát hành | Artifact/deployment có định danh gắn với commit |
| 5 | Apply migration nếu có | Release runner duy nhất, đúng DB; migration/status không lỗi |
| 6 | Deploy hoặc cho bản đã build nhận traffic | Deployment đúng commit, không bỏ qua CI/approval |
| 7 | Kiểm tra sau phát hành | Swagger/assets, API auth/read và logs; ghi nhận kết quả |

Build có thể chạy trước migration vì không cần DB thật. Điều bắt buộc là code cần schema mới không
nhận traffic trước khi schema sẵn sàng. Khi code cũ còn chạy, migration phải tương thích với nó.
Với đổi/xóa field, làm nhiều release theo [hướng dẫn thay đổi có dữ liệu](../../database/schema/change-existing-fields.md).

## Chọn một công cụ điều phối CD

| Cách | Phù hợp khi | Cần cấu hình thêm |
| --- | --- | --- |
| Vercel Git + Deployment Checks | Giữ hosting hiện tại, ít vận hành | Required CI checks trước khi gán domain; migration là release step riêng |
| GitHub Actions + Vercel CLI/API | Cần điều phối migration/approval/deploy rõ trong một workflow | Credentials theo environment, gate trước job, CLI khóa phiên bản và điều kiện chỉ đúng SHA |
| GitHub Actions + registry/container platform | Chuyển sang Docker, VM hoặc dịch vụ container | Build/push image, khóa digest, release job migration và rollout trên nền tảng đích |

Chọn **một bên điều phối cho mỗi môi trường**. Nếu Actions chủ động deploy bằng CLI thì phải xử lý
Git auto-deploy tương ứng để tránh hai pipeline phát hành cùng commit. Chưa cần thêm Kubernetes/Argo CD
cho một API nếu chưa có nhu cầu vận hành cụ thể.

## Gate production cần gì?

- CI và review của đúng release commit.
- Người chịu trách nhiệm phát hành; approval dùng GitHub Environment khi gói tài khoản hỗ trợ,
  hoặc quy trình phê duyệt/triển khai thủ công được ghi nhận.
- Giới hạn branch production, quyền secrets tối thiểu và chỉ một release/migration chạy mỗi môi trường tại một thời điểm.
- Migration thất bại thì dừng phát hành; không reset, seed demo hoặc đánh dấu applied khi chưa điều tra.

Job Actions tương lai phải khai báo `environment: production`, phụ thuộc kết quả CI và dùng nhóm
concurrency riêng theo environment. Không hủy một migration đang chạy chỉ vì có commit mới;
đồng thời kiểm tra không phát hành một SHA cũ sau bản mới. PR/fork không được nhận secret phát hành.
Workflow hiện chưa triển khai các bước này.

## Migration trong CD dùng lệnh nào? {#migration-commands}

| Môi trường thực thi | Lệnh/nguồn cấu hình |
| --- | --- |
| Máy release có file env được chuẩn bị riêng | `db:migrate:apply:staging` hoặc `db:migrate:apply:production`; script bắt buộc đọc file đúng môi trường |
| Job CI/CD được cấp secrets trực tiếp | `npm run db:migrate:apply`; đọc env của runner qua `prisma.config.ts`, không dựa vào file env local |

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
