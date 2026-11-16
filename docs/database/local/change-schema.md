# Dev: thêm bảng/field và tạo migration

**Dùng khi:** bạn tự sửa model trong `prisma/models/`, ví dụ thêm bảng hoặc thêm field.
**Kết quả:** có file SQL đã review, DB dev được cập nhật và client được sinh lại để code dùng field mới.
Nếu chỉ nhận migration từ đồng đội, dùng [cập nhật DB dev](./index.md); không tạo migration trùng.

## Lệnh nào thực sự tạo bảng hoặc thêm cột trong DB?

**Apply nghĩa là chạy SQL trực tiếp trên DB đích.** Nếu migration chứa `CREATE TABLE`,
apply sẽ tạo bảng; nếu chứa `ALTER TABLE ... ADD COLUMN`, apply sẽ thêm cột vào bảng đang có.
Lệnh apply không chỉ sinh file trong source.

| Lệnh | Tác động trực tiếp đến DB đích |
| --- | --- |
| `npm run db:validate` | Không tạo bảng/cột; chỉ kiểm tra Prisma schema. |
| `npm run db:migrate:dev -- --name add_party_website --create-only` | Sinh file SQL; **chưa chạy migration mới này trên DB dev**. Vẫn dùng kết nối dev/shadow để kiểm tra. |
| `npm run db:migrate:dev` | **Có: chạy SQL trên DB dev**, tạo bảng/thêm cột theo các migration chưa áp dụng. Có thể sinh migration nếu model còn thay đổi chưa có SQL. |
| `npm run db:migrate:apply:staging` | **Có: chạy SQL trực tiếp trên DB staging** từ `.env.staging`, áp dụng migration còn thiếu. |
| `npm run db:migrate:apply:production` | **Có: chạy SQL trực tiếp trên DB production** từ `.env.production`, áp dụng migration còn thiếu. |
| `npm run db:generate` | Không tạo bảng/cột; sinh client/types và metadata trong source. |
| `npx prisma migrate status` | Không cập nhật DB; kiểm tra lịch sử migration trên DB đang cấu hình. |

**Ví dụ thêm `website`:** sửa model → `--create-only` sinh `migration.sql` → đọc SQL →
`npm run db:migrate:dev` **mới thực sự thêm cột `website` vào DB dev** → `db:generate` cập nhật client.
Khi phát hành, lệnh `db:migrate:apply:staging` hoặc `db:migrate:apply:production`
**mới thực sự thêm cột đó vào DB của môi trường tương ứng**.

## 1. Chuẩn bị và sửa model

Chạy các lệnh dưới đây tại **root repository `debtflow-api`**, trên DB development riêng.
`prisma.config.ts` đọc `.env` và cấu hình kết nối từ `src/config/app.config.ts`.
Biến đã có trong shell có thể được ưu tiên hơn `.env`; kiểm tra cả `DATABASE_URL` và `DIRECT_URL`
đều thuộc môi trường dev trước khi chạy. `NODE_ENV=development` không tự bảo đảm chọn đúng DB.
Xem [cấu hình kết nối](../configure-connection.md).

Ví dụ: mở `prisma/models/party.prisma`, thêm dòng sau **bên trong model `Party`**:

```prisma
website String?
```

`String?` nghĩa là field có thể `null`: các Party cũ chưa có website vẫn hợp lệ.
Đây chỉ là ví dụ hướng dẫn, không phải field đã được thêm vào source hiện tại.
Với bảng mới, thêm model tương ứng vào `prisma/models/`; các bước tiếp theo giống nhau.

**Sau bước này:** mới thay đổi file model, DB chưa có cột/bảng mới. Sửa model không tự cập nhật DB.
Với field bắt buộc, rename, đổi kiểu hoặc xóa dữ liệu, xem [các tình huống thay đổi schema](../../deployment/environments/schema-changes.md)
trước khi tạo SQL; không áp dụng máy móc ví dụ thêm field nullable này.

## 2. Kiểm tra model có hợp lệ không

```bash
npm run db:validate
```

Lệnh gọi `prisma validate`: kiểm tra cú pháp và cấu trúc Prisma schema, ví dụ relation khai báo sai.
Nó **không tạo migration, không thêm cột vào DB và không sinh client**.

**Kết quả mong đợi:** CLI báo schema hợp lệ; nếu báo lỗi, sửa model trước khi tiếp tục.
Nếu bỏ qua, lệnh migrate vẫn kiểm tra schema, nhưng bạn sẽ phát hiện lỗi muộn hơn.
Validate thành công chưa chứng minh SQL an toàn hoặc dữ liệu cũ phù hợp với thay đổi.

## 3. Tạo file SQL để đọc trước khi chạy

```bash
npm run db:migrate:dev -- --name add_party_website --create-only
```

| Thành phần | Ý nghĩa |
| --- | --- |
| `npm run db:migrate:dev` | Chạy script `prisma migrate dev` trong `package.json`, dành cho DB development. |
| `--` | Chuyển các tham số phía sau từ npm đến Prisma CLI. |
| `--name add_party_website` | Đặt tên mô tả thay đổi; thay bằng tên phù hợp với công việc của bạn. |
| `--create-only` | Sinh migration mới để review, chưa áp dụng migration mới đó vào DB dev. |

**“Draft migration” là gì?** Là file SQL migration bình thường vừa được sinh ra nhưng chưa apply.
Không có một loại file “draft” riêng. Tách bước này giúp bạn đọc SQL trước khi nó sửa cấu trúc DB.

**File nằm ở đâu?** Trong source của dự án, không phải chỉ trong database:

```text
prisma/
  models/
    party.prisma
  migrations/
    <timestamp>_add_party_website/
      migration.sql
```

`<timestamp>` do Prisma tạo để sắp thứ tự migration. Nếu không có thay đổi schema cần tạo,
Prisma có thể không sinh migration mới. Mở file `migration.sql` vừa tạo; với ví dụ website,
SQL dự kiến có dạng:

```sql
ALTER TABLE "Party" ADD COLUMN "website" TEXT;
```

Đây là **SQL minh họa để đối chiếu**, không cần copy chạy riêng trong DBeaver.
Kiểm tra SQL chỉ thêm cột mong muốn, không có `DROP TABLE`, `DROP COLUMN` hoặc thay đổi ngoài phạm vi.
Với model mới, kiểm tra tên bảng, field, khóa ngoại và index được tạo đúng yêu cầu.

**Nếu không dùng `--create-only` thì sao?** `migrate dev` có thể sinh và áp dụng migration ngay.
Prisma hỗ trợ cách đó, nhưng bạn mất bước đọc/chỉnh SQL trước khi apply. Quy trình ở đây giữ bước review
để phát hiện thay đổi ngoài ý muốn. Chỉ sửa migration mới chưa apply/chia sẻ; không sửa migration cũ đã chạy.

::: warning Vẫn cần kết nối DB
`--create-only` không phải chế độ offline. Prisma dùng shadow DB để chạy lại lịch sử và phát hiện
schema drift — cấu trúc DB khác với lịch sử migration. Shadow DB là DB tạm phục vụ kiểm tra,
không phải DB staging/production. Nếu CLI yêu cầu reset, dừng và đọc [xử lý drift](../schema/migration-failure.md);
không chấp nhận reset DB có dữ liệu cần giữ. Repo chưa cấu hình shadow URL riêng.
:::

Theo [Prisma CLI v7](https://www.prisma.io/docs/cli/v7/migrate/dev), `--create-only` tạo migration
mà chưa apply; lệnh vẫn cần [shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).

## 4. Chạy SQL trực tiếp trên DB dev: tạo bảng hoặc thêm cột

Sau khi đọc và xác nhận `migration.sql` đúng:

```bash
npm run db:migrate:dev
```

**Đây là lệnh thực sự thay đổi cấu trúc DB dev.** Lệnh chạy SQL trong các migration chưa áp dụng,
bao gồm file vừa tạo: SQL tạo bảng sẽ tạo bảng, SQL thêm cột sẽ thêm cột trên DB.
Prisma ghi nhận migration đã chạy trong bảng `_prisma_migrations` để quản lý lịch sử.
Đừng chạy lệnh này với URL staging/production.

**Trước:** source có `website` và file SQL, DB dev chưa có cột mới.
**Sau khi thành công:** DB dev có cột `Party.website`; các dòng cũ có giá trị `null`.
CLI thường hiển thị `Applying migration ...` và thông báo DB đồng bộ với schema.
Nếu không có migration còn thiếu, sẽ không có thay đổi mới để apply.

**Nếu bỏ qua:** DB vẫn thiếu cột/bảng; code truy vấn field mới có thể lỗi khi chạy.
Nếu lệnh thất bại, xử lý lỗi trước khi tiếp tục; không dùng generate để thay thế migrate.

## 5. Sinh lại client và kiểu dữ liệu cho code

```bash
npm run db:generate
```

Script sinh Prisma Client cùng list-query metadata và response models theo cấu hình generator của dự án.
Các file được sinh dưới `src/generated/`; không chỉnh tay.
**Lệnh này sửa file generated trên máy, không chạy SQL cập nhật DB.**

**Kết quả mong đợi:** các generator báo thành công; Prisma Client/types nhận biết field mới.
Nếu bỏ qua, client/types có thể còn theo schema cũ và TypeScript chưa nhận ra `website`.
Prisma CLI v7 không tự chạy generate hoặc seed trong `migrate dev`, nên bước này chạy riêng.
[Tham khảo Prisma v7](https://www.prisma.io/docs/cli/v7/migrate/dev#how-it-works).

## 6. Kiểm tra kết quả trước khi bàn giao

```bash
npx prisma migrate status
```

Lệnh đối chiếu lịch sử migration trong checkout với DB dev, không apply SQL.
**Kết quả mong đợi:** `Database schema is up to date!` — không còn migration chưa áp dụng.
Nếu còn pending hoặc failed migration, xử lý trước khi bàn giao.
Status không thay thế kiểm tra schema drift hay kiểm thử API.

Mở bảng `Party` trong DBeaver và refresh metadata để xác nhận có cột `website`.
Sau đó cập nhật DTO, projection, mapper và API nếu field cần được nhận/trả;
field trong DB **không tự trở thành field công khai của API**.
Chạy typecheck/build và test đúng phần ảnh hưởng theo policy của dự án.

| Thành phần | Sau khi hoàn tất ví dụ |
| --- | --- |
| `prisma/models/party.prisma` | Có `website String?`. |
| Migration mới | Có SQL thêm cột, đã review. |
| DB dev | Có cột `website`, migration được ghi nhận đã chạy. |
| Client/types generated | Nhận biết field mới. |
| API liên quan | Nhận/trả field chỉ khi contract và code đã được cập nhật. |

## 7. Đưa cùng migration lên staging/production

Commit model, **thư mục migration mới**, code/test và reference liên quan.
Không commit env thật, client generated hoặc `dist/`; không đổi tên/sửa migration đã apply hoặc chia sẻ.
Đồng đội nhận code chạy [cập nhật DB dev](./index.md), không sinh lại migration cho cùng thay đổi.

Staging/production dùng **chính file SQL đã commit**, không chạy `migrate dev` để tạo lại SQL.
Release runner áp dụng migration còn thiếu bằng script của môi trường, ví dụ staging:

```bash
npm run db:migrate:apply:staging
npm run db:migrate:status:staging
```

**Lệnh đầu chạy SQL trực tiếp để tạo bảng/thêm cột trên DB staging. Lệnh thứ hai chỉ kiểm tra.**
Script đọc `.env.staging`; `apply` gọi `prisma migrate deploy`, còn `status` chỉ kiểm tra lịch sử.
DB trống sẽ chạy toàn bộ migration; DB đã có lịch sử chỉ chạy các migration còn thiếu.
Nếu không có migration mới thì không có SQL mới để apply; nó không copy dữ liệu dev lên staging.

Đây là bước trong release, không phải lệnh tự chạy ngay sau khi sửa model.
Theo [quy trình staging](../../deployment/environments/staging.md) rồi
[production từng bước](../../deployment/environments/production.md) để phối hợp thứ tự code và DB,
kiểm tra trước/sau và xử lý lỗi. Với rename/DROP/backfill, dùng
[hướng dẫn theo tình huống](../../deployment/environments/schema-changes.md).
