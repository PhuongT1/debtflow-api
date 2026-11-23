# Triển khai: từ CI đến production

**Dùng khi:** chuẩn bị kiểm tra một PR, phát hành staging/production hoặc đổi nền tảng hosting.
Cấu hình workflows và cách chạy nằm ở [CI/CD](./ci-cd.md).
Chạy local và debug nằm ở [Bắt đầu](../getting-started/running/index.md).

## CI và CD khác nhau thế nào?

| Phần                        | Câu hỏi cần trả lời                                         | Kết quả                                                  |
| --------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| CI — Continuous Integration | Commit có build được, đúng quy tắc và qua test không?       | Kết quả kiểm tra gắn với commit; chưa có nghĩa đã deploy |
| CD — Continuous Delivery    | Bản nào đã sẵn sàng và được duyệt để phát hành?             | Release được kiểm soát; có thể cần người bấm phát hành   |
| CD — Continuous Deployment  | Bản đạt điều kiện có tự được đưa lên môi trường đích không? | Triển khai tự động sau các điều kiện đã cấu hình         |

Với DebtFlow, chọn **CI tự động và phát hành production có kiểm soát**. GitHub Actions chạy CI trên PR.
Hai workflow **Deploy staging / Deploy production** chạy thủ công và xác minh nội dung source đã qua CI.

## Hiện có gì trong repository?

| Thành phần                                         | Trạng thái xác minh từ source                                                                                                                    | Nguồn                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| CI cho PR và chạy thủ công                                  | Có workflow `API quality`, job `quality`                                                                                                         | `.github/workflows/quality.yml`              |
| Kiểm tra code, test và docs                        | Có trong npm scripts và CI                                                                                                                       | `package.json`                               |
| Vercel Git auto-deploy                             | Tắt mọi nhánh có cấu hình này; phải merge cấu hình vào nhánh tương ứng                                                                           | `vercel.json`                                |
| Chọn Production Branch, secrets, Deployment Checks | Cấu hình bên ngoài repository; phải kiểm tra trên dashboard                                                                                      | [Hướng dẫn Vercel](./platforms/vercel.md)    |
| CD thủ công                                        | Có `deploy-vercel.yml`: kiểm tra SHA/CI/staging → build → migration tùy chọn → deploy → smoke và promote riêng cho production; secrets và environments cần thiết lập | [Thiết lập CD](./cd/github-actions-setup.md) |
| Image chạy Node                                    | Có Dockerfile; chưa có workflow publish image/rollout                                                                                            | `Dockerfile`                                 |

Tài liệu phân biệt **đang có** với **cần cấu hình**. Việc đọc trang này không tự bật branch protection,
approval, migration hoặc một pipeline CD trên tài khoản hosting.

Nếu bạn cần deploy ngay, mở **[checklist production: code và DB từng bước](./environments/production.md)**.
Trang con [các tình huống schema](./environments/schema-changes.md) giúp chọn thứ tự cho thêm/đổi/xóa bảng hoặc field.

## Luồng phát hành đề xuất

```mermaid
flowchart TD
  A[Feature branch và Pull Request] --> B[CI: API quality]
  B --> C{CI và review đạt?}
  C -- Không --> A
  C -- Có --> D[Merge develop: kiểm thử staging]
  D --> E[PR phát hành vào main: CI và review]
  E --> F[Chọn commit và kiểm tra migration tương thích]
  F --> G[Apply migration nếu có, kiểm tra trạng thái]
  G --> H[Deploy production chưa chuyển domain]
  H --> S[Kiểm tra OpenAPI qua /docs-json]
  S --> P[Đạt mới promote: chuyển domain production]
  P --> I[Kiểm tra domain, logs và theo dõi]
  I --> J{Ổn định?}
  J -- Không --> K[Rollback code tương thích hoặc forward fix]
  J -- Có --> L[Ghi nhận release]
```

Merge không kích hoạt CI hoặc CD. Git auto-deploy lên Vercel đã tắt theo cấu hình trong repo.
Bắt đầu từ [thiết lập GitHub/Vercel](./cd/github-actions-setup.md), rồi [bấm Deploy](./cd/manual-release.md).
Quy trình không được coi là hoạt động trên tài khoản cho đến khi cấu hình và kiểm chứng staging.

<SectionIndex section="/deployment/" />

## Tham khảo và phần áp dụng

Đã đối chiếu source Vendure tại commit `3ef5fbe70e59ddfd70b4753e9c164ec7934d03eb`:

- [Build & Test](https://github.com/vendure-ecommerce/vendure/blob/3ef5fbe70e59ddfd70b4753e9c164ec7934d03eb/.github/workflows/build_and_test.yml): tách build, unit test, codegen và phát hiện phần ảnh hưởng.
- [Docs CI](https://github.com/vendure-ecommerce/vendure/blob/3ef5fbe70e59ddfd70b4753e9c164ec7934d03eb/.github/workflows/docs_ci.yml): kiểm tra tài liệu có owner riêng.
- [Publish to NPM](https://github.com/vendure-ecommerce/vendure/blob/3ef5fbe70e59ddfd70b4753e9c164ec7934d03eb/.github/workflows/publish_to_npm.yml): tách phát hành khỏi kiểm tra và giới hạn môi trường/quyền publish.

DebtFlow học cách tách trách nhiệm và gate; không sao chép Bun, ma trận nhiều DB/Node hay publish npm
của một thư viện vào API Node 24/PostgreSQL. Phạm vi CI thực tế nằm ở trang tiếp theo.
