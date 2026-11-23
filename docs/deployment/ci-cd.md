# CI/CD với GitHub Actions

Chọn đúng việc cần làm. **Cấu hình**, **CI** và **chạy CD** là ba phần riêng:

| Bạn cần làm gì? | Mở trang |
| --- | --- |
| Lấy token/ID, tạo GitHub Environments và điền secrets | [Cấu hình cho workflow GitHub Actions](./cd/github-actions-setup.md) |
| Biết CI chạy khi nào, kiểm tra gì và xem kết quả | [CI: kiểm tra code](./ci/index.md) |
| Bắt buộc CI đạt trước merge, xử lý check thất bại | [Bảo vệ nhánh và xử lý CI lỗi](./ci/pull-requests.md) |
| Chọn commit, bấm Deploy staging/production và theo dõi từng step | [CD: chạy phát hành](./cd/manual-release.md) |

**Luồng sử dụng:** cấu hình một lần → PR chạy CI → CI đạt → người phụ trách bấm chạy CD.
CI không tự deploy; CD không tự chạy khi push theo cấu hình hiện tại.

Cấu hình API/DB và kế hoạch phát hành được quản lý ở các phần tương ứng:

- [Runtime Vercel: DB URL, JWT và CORS](../database/releases/connect-runtime.md#vercel-runtime).
- [Triển khai: chuẩn bị code, database và vận hành](./index.md).

## Tên workflow, job và file

| Workflow | Job ID | File |
| --- | --- | --- |
| `API quality` (CI) | `quality` | `.github/workflows/quality.yml` |
| `Deploy staging` | `release` | `.github/workflows/deploy-staging.yml` |
| `Deploy production` | `release` | `.github/workflows/deploy-production.yml` |
| CD dùng chung | `verify` → `deploy` | `.github/workflows/deploy-vercel.yml` |

`quality` kiểm tra code. `verify` kiểm tra điều kiện phát hành. `deploy` build và triển khai sau khi `verify` đạt.
CI không cần secrets thật; job `deploy` dùng cấu hình được giải thích tại
[Thông tin cần cấp cho GitHub Actions](./cd/github-actions-setup.md).
