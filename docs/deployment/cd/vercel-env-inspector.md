<script setup>
import VercelEnvInspector from '../../.vitepress/theme/VercelEnvInspector.vue';
</script>

# Thử API env Vercel

Chạy `npm run docs:dev` và mở trang này trên **localhost**. Công cụ chỉ đọc env, không deploy,
không chạy migration và không sửa cấu hình Vercel. Bản docs đã build/publish không có cầu nối API này.

Nhập Vercel Access Token, Project ID/tên và Team ID/slug đang dùng cho job. Mặc định thử **Preview / develop**.
Token có thể được tự điền từ `.env.vercel-inspector.local` (Git bỏ qua, quyền `0600`),
khóa `VERCEL_INSPECTOR_TOKEN`. File này chỉ được docs server local đọc, không đóng gói vào docs publish.
Không nhập DB URL hoặc JWT vào ô token. Kết quả chỉ giữ trong bộ nhớ trang, không lưu vào file, URL
hoặc localStorage. **Xóa token và kết quả** xóa dữ liệu trên trang; tải lại trang sẽ nạp token local lại.

<ClientOnly>
  <VercelEnvInspector />
</ClientOnly>

## Cách đối chiếu lỗi deploy

1. **Liệt kê biến:** gọi Project API, xem `type`, `visibility`, target và branch. Value ở API danh sách
   chưa chắc là plaintext; không dùng nó làm connection string chỉ vì có dữ liệu.
2. **Đọc qua API:** dùng ID của biến để thử endpoint decrypted-value. Xem HTTP status, `decrypted`
   và trạng thái value mà API thực sự trả về.
3. **Thử env pull:** gọi đường `/v3/env/pull/{project}/{target}/{branch}` mà CLI sử dụng.
   Bảng hiện một giá trị mỗi biến, ưu tiên `env`. Biến chỉ có trong `buildEnv` dùng giá trị từ nguồn đó.
   Bật tùy chọn hiển thị biến bổ sung để xem các biến hệ thống và tooling.
4. Để trống branch và thử lại để so sánh Preview chung với override `develop`.

Value che mặc định. **Xem value** hiển thị giá trị trực tiếp. Bảng ghi trạng thái riêng cho chuỗi rỗng và placeholder.
Không chụp/chia sẻ màn hình khi đang hiện credentials. API có thể trả token hệ thống trong kết quả pull.
Nếu Secret không trả giá trị, công cụ hiển thị đúng phản hồi; không tìm cách khôi phục hay thay đổi Secret.

`/v3/env/pull` là đường nội bộ của CLI, có thể đổi theo phiên bản. Hai endpoint Project API được
mô tả tại [list env](https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name)
và [decrypted value](https://vercel.com/docs/rest-api/projects/retrieve-the-decrypted-value-of-an-environment-variable-of-a-project-by-id).
Công cụ này kiểm tra API, không giả lập toàn bộ bước ghi file/xử lý env của Vercel CLI 65.14.0.
