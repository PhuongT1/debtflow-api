# Phát hành production: code và DB từng bước

**Dùng khi:** đưa một bản API đã kiểm thử lên production, có hoặc không có migration.
Đây là checklist chính; làm theo thứ tự và dừng ở bước lỗi. Lệnh bên dưới dành cho **release runner có
file `.env.production`**, không phải Terminal bất kỳ đang trỏ DB dev.

## 1. Chọn đúng trường hợp trước khi bắt đầu

| Release thay đổi gì? | Kế hoạch |
| --- | --- |
| Chỉ code, không thay schema | Kiểm tra DB hiện tại phù hợp; bỏ bước apply nếu không có migration pending |
| Thêm bảng/cột nullable tương thích code cũ | Migration trước → code mới → smoke test |
| Field bắt buộc, rename, đổi kiểu hoặc dữ liệu cần chuyển | Chia nhiều release: mở rộng → code chuyển tiếp/backfill → cleanup |
| Xóa field/bảng | Bản code ngừng dùng phải chạy hết trên mọi consumer trước release chứa DROP |
| Production là DB trống | Tạo DB/credentials → apply toàn bộ migration → tạo dữ liệu/account bắt buộc → deploy |

Xem [các tình huống code và DB](./schema-changes.md) để chọn thứ tự. Không dùng một lần
merge để vừa xóa field cũ đang dùng, vừa hy vọng mọi instance chuyển sang code mới cùng lúc.

## 2. Hoàn tất ở dev và staging

**Nơi thực hiện:** máy dev và staging; chưa ghi production.

- Dev sửa model, tạo/review migration SQL, cập nhật code/DTO/projection và test phần ảnh hưởng.
- Commit model + migration + code liên quan. Schema thay đổi nhưng chưa có migration thì chưa sẵn sàng.
- Apply chính các migration đó trên staging, deploy code tương ứng và kiểm chứng dữ liệu/API.
- Lưu SHA, tên migration, URL staging và kết quả CI/review. Ghi code cũ có chạy được với schema mới không.

Theo [DB dev](../../database/local/index.md), [tạo migration](../../database/local/change-schema.md) và
[staging](./staging.md). **Không copy DB dev lên production**, không tạo lại SQL ở production.
Dữ liệu nghiệp vụ production được giữ riêng; backfill có kế hoạch riêng.

**Đạt khi:** CI/review và staging đạt; SQL cuối cùng trong release không khác bản đã kiểm thử.
Nếu merge tạo thêm thay đổi schema, review/kiểm thử lại phần đó trước bước production.

## 3. Chuẩn bị release runner, runtime và đường quay lui

**Nơi thực hiện:** máy maintainer được cấp quyền hoặc job release; checkout đúng bản phát hành,
root có `package.json`, `prisma.config.ts`, `prisma/migrations/`.

```bash
# Select the project runtime and install this release's locked dependencies, including Prisma CLI.
nvm use
npm ci
```

`npm ci` chưa apply schema. Không dùng runtime image đã prune dev dependencies làm migration runner.

| Việc cần xác nhận | Kết quả cần có trước khi ghi DB |
| --- | --- |
| Đúng DB | `.env.production` có cả hai URL đúng DB production; runner kết nối được |
| Runtime cùng DB đích | Secrets Production trên Vercel/host/container đúng môi trường; không dùng URL dev/staging |
| Backup/restore | Có điểm khôi phục và quy trình restore khả thi; biết dữ liệu nào có nguy cơ mất |
| Quyền và thời gian chạy | Người được giao thao tác, một release/migration runner cho môi trường tại một thời điểm |
| Kế hoạch schema | Tương thích code cũ hoặc có maintenance/cutover đã duyệt; backfill đã review |
| Code quay lui | Deployment/image cũ và khả năng tương thích với schema sau migration |
| Chặn code phát hành sớm | Có gate/promotion thủ công phù hợp trước khi merge `main` |

Làm theo [kết nối runtime và runner](../../database/releases/connect-runtime.md) nếu chưa chuẩn bị URL.
**Dừng nếu không xác định được DB đích hoặc thứ tự code/schema.**

Trên Vercel, push/merge `main` có thể tạo production deployment ngay. Cần cấu hình
[gate phát hành](../platforms/vercel.md) trước. Nếu chưa có gate đáng tin cậy, phải kiểm soát auto-promotion/
phát hành thủ công trước khi đẩy commit phụ thuộc schema mới; không giả định CI tự chặn nó.

## 4. Kiểm tra trước: production thiếu migration nào?

**Nơi chạy:** Terminal tại root checkout release trên runner có `.env.production`.

```bash
# Inspect production migration history without applying SQL.
npm run db:migrate:status:production
```

| Output | Ý nghĩa và việc tiếp theo |
| --- | --- |
| Liệt kê migration chưa apply | Đối chiếu từng tên/SQL với release; status có thể exit khác 0 vì pending, chưa phải apply thất bại |
| `Database schema is up to date!` | Không còn pending theo lịch sử; với release code-only có thể bỏ bước 5 |
| Failed migration, lịch sử khác nhau, không kết nối được | Dừng; xử lý đúng nguyên nhân, không reset hoặc đánh dấu applied để né lỗi |

Lệnh apply chạy **tất cả migration pending theo thứ tự**, không chỉ file bạn vừa thêm.
Nếu thấy migration không thuộc kế hoạch, dừng và review cả chuỗi. Status không kiểm chứng DB chưa bị sửa tay.

## 5. Apply migration đã review

**Điều kiện:** các bước trước đạt; chưa cho code cần schema mới nhận traffic. Với cleanup/DROP,
code ngừng dùng dữ liệu cũ phải đã được triển khai ở release trước và mọi worker/instance cũ đã dừng.

```bash
# Apply the reviewed pending migrations to production.
npm run db:migrate:apply:production
```

Đợi lệnh kết thúc. **Output minh họa**, tên/số migration phụ thuộc release:

```text
Applying migration `<migration-name>`
...
All migrations have been successfully applied.
```

Không có migration mới thì thấy `No pending migrations to apply.`.
Chỉ có dòng `Applying migration` chưa đủ để kết luận thành công.

**Nếu lỗi:** dừng deploy/promote, giữ thông tin migration lỗi và kiểm tra DB. Một phần lịch sử có thể
đã được apply; không mặc định cả chuỗi tự rollback. Theo [migration lỗi](../../database/schema/migration-failure.md).

Sau apply thành công:

```bash
# Confirm the production migration history matches the release.
npm run db:migrate:status:production
```

**Đạt khi:** status báo `Database schema is up to date!`; đối chiếu cột/bảng/index thay đổi trên
connection production nếu cần. Backfill/constraint còn chưa hoàn tất thì chưa cho code phụ thuộc chúng chạy.
Chi tiết lịch sử SQL ở [migration-order](../../database/migrations/order.md).

Job CD chỉ nhận secrets trực tiếp dùng lệnh generic theo [CD](../cd/index.md#migration-commands);
không gọi script suffix production nếu job không có file env mà script yêu cầu.

## 6. Phát hành code đã kiểm thử

**Vercel:** sau schema tương thích đã sẵn sàng, merge PR release vào `main` hoặc cho deployment đã
build nhận traffic theo gate. Xác nhận CI của commit thực tế sau merge đạt, SQL vẫn đúng bộ đã áp dụng,
Production variables đúng và deployment trỏ đúng commit. Không Force Promote để bỏ qua lỗi.

**Host Node:** ở build runner, chạy `npm run build`, tạo artifact gồm `dist/`, `package.json` và runtime
dependencies tương thích OS/CPU. Có thể build trước bước 5 nhưng chưa start bản mới nhận traffic.
Trên host đã có environment production:

```bash
# Run the compiled release with production runtime settings on the destination host.
NODE_ENV=production npm start
```

Process manager của host chịu trách nhiệm restart, chuyển traffic và graceful shutdown.
Nếu cần prune dependencies, chạy `npm prune --omit=dev --ignore-scripts` sau khi build và hoàn tất
các bước runner cần CLI, hoặc tạo artifact ở job riêng.

**Container:** rollout đúng image digest đã build từ release theo [Docker](../platforms/docker.md).
Không chạy migration trên mỗi replica/startup. Build image/start API hiện không cập nhật schema.

## 7. Kiểm tra sau deploy và chốt release

**Nơi kiểm tra:** URL production, runtime logs và DB connection production.

- Đối chiếu SHA/deployment ID; API dùng đúng môi trường.
- `/docs`, `/docs-json` và assets tải được.
- Login + API đọc liên quan bằng tài khoản được cấp: đúng tenant, quyền, dữ liệu và field mới.
- Kiểm tra write/backfill theo kịch bản được phép; không tạo giao dịch thật tùy tiện.
- Theo dõi lỗi 5xx, timeout và kết nối DB; ghi kết quả vào release record.

**Hoàn tất khi:** migration phù hợp, code mới phục vụ đúng và phần ảnh hưởng đã kiểm chứng.
Nếu lỗi, dùng [vận hành/rollback](../cd/operations.md). Rollback code không tự khôi phục DB;
với schema không tương thích code cũ phải chọn forward fix hoặc kế hoạch khôi phục đã duyệt.

## Checklist trước khi xác nhận hoàn tất

- [ ] Code/model/migration đã review, CI và staging đạt.
- [ ] Runner/runtime cùng DB production; credentials không nằm trong Git/image.
- [ ] Có backup và đánh giá tương thích code cũ/schema mới.
- [ ] Đã kiểm tra toàn bộ pending; apply thành công hoặc xác nhận không cần apply.
- [ ] Backfill/constraint cần cho code mới đã sẵn sàng.
- [ ] Deployment đúng commit, không bỏ gate.
- [ ] Smoke test/logs đạt; lưu SHA, migration, deployment và phương án quay lui.
