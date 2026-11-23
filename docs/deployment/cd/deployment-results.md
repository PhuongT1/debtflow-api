# Kết quả và log

**Mở từ:** GitHub Actions → lần chạy → Summary → Deployment, hoặc Vercel → Deployments.

| Nơi xem | Có thông tin gì |
| --- | --- |
| **GitHub → Actions → Summary** | Run, commit SHA, CI liên quan và URL **Deployment** khi upload thành công. |
| **GitHub → release / deploy → log từng bước** | Checkout, npm, pull env, build NestJS/Vercel CLI, Prisma migration/status, upload và kết quả kiểm tra hoặc promote production. |
| **Vercel → Deployments** | Các bản Vercel đã nhận, trạng thái như **Ready** hoặc **Error**, môi trường **Preview** hoặc **Production**, thời điểm, commit/branch nếu có metadata và trang chi tiết của từng deployment. |
| **Vercel → Deployment → Build Logs** | Log phía Vercel khi xử lý deployment. Với `--prebuilt`, mục này vẫn có thể hiện thông tin máy, vùng xử lý và file đầu ra dù NestJS đã build trên GitHub. Tìm log compile đầy đủ ở bước **Build Vercel output** trên GitHub. |
| **Vercel → Deployment → Logs / Runtime Logs** | Request và log phát sinh khi API chạy, dùng để điều tra lỗi 5xx hoặc lỗi kết nối DB lúc xử lý request. Phạm vi lịch sử phụ thuộc gói Vercel. |
| **DB đích → `_prisma_migrations`** | Lịch sử Prisma đã ghi khi áp dụng migration. Dùng cùng log GitHub để xác minh migration, thay vì suy ra từ trạng thái **Ready** trên Vercel. |

Đối chiếu bằng **URL Deployment** hoặc ID trước, rồi so SHA, môi trường và thời điểm. Trong ảnh,
SHA `ee27923` xuất hiện hai lần dưới **Preview**. Cùng SHA có thể được deploy nhiều lần,
mỗi lần có bản ghi riêng. Trang chi tiết ghi **Source: CLI** vì deployment được tạo qua CLI,
dù vẫn có nhánh và thông tin Git. Dòng **Assigning Custom Domains: Skipped** của bản Preview
không cản việc mở URL Preview riêng. Nếu job dừng trước upload, tìm lỗi ở GitHub vì lần chạy đó
chưa tạo deployment trên Vercel.

Nguồn: [Deploy từ Vercel CLI](https://vercel.com/docs/cli/deploying-from-cli),
[Deployment details](https://vercel.com/docs/deployments/managing-deployments),
[Runtime Logs](https://vercel.com/docs/logs/runtime).

## Tìm nguyên nhân theo dấu hiệu

1. **GitHub báo lỗi trước upload:** mở bước đỏ đầu tiên trong `release / verify` hoặc `release / deploy`.
   Đối chiếu tên bước với [Trình tự deploy](./deployment-sequence.md).
2. **Vercel hiện Ready nhưng GitHub production báo lỗi:** xem log OpenAPI và promote trong GitHub,
   rồi kiểm tra domain đang trỏ đến deployment nào.
3. **Job thành công nhưng API lỗi:** mở Runtime Logs của đúng deployment, lọc theo thời điểm và
   đường dẫn request. Dùng URL riêng của bản Preview khi đối chiếu staging.

### Migration báo `P1001`

1. Mở **Verify direct database connection from the runner** trong log GitHub. Bước này xác minh runner
   kết nối được qua `DIRECT_URL` trước khi Prisma ghi migration.
2. Với staging, đối chiếu `DIRECT_URL` ở **GitHub → Settings → Environments → staging** với chuỗi Direct
   của đúng Neon branch, database và role. GitHub secret được ưu tiên khi có. Giữ thông số TLS từ Neon.
3. Nếu lỗi DNS hoặc timeout, kiểm tra endpoint, trạng thái compute và quyền truy cập mạng từ runner đến
   cổng PostgreSQL. Nếu preflight qua mà Prisma vẫn báo `P1001`, kiểm tra timeout riêng của Prisma qua
   `connect_timeout` trên `DIRECT_URL` và đối chiếu thời điểm với Neon. API trên Vercel kết nối qua
   `DATABASE_URL` nên một deployment Preview thành công chỉ xác nhận đường deploy của ứng dụng.
   [Hướng dẫn chẩn đoán của Prisma](https://www.prisma.io/postgres/migration-cannot-reach-database) ·
   [Neon về timeout kết nối](https://neon.com/blog/prisma-dx-improvements)

Xem thêm [vận hành và rollback](./operations.md).
