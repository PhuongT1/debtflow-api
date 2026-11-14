# Mang bộ rules sang dự án NestJS khác

**Dùng khi:** thiết lập bộ rules cho một repository NestJS khác.
Copy **chỉ** `.ai/core/` và `scripts/ai/ai-setup.mjs` vào cùng đường dẫn tại repo mới. Không mang
manifest, nghiệp vụ, baseline, Prisma/auth decorators hay checkers riêng DebtFlow sang làm quy tắc chung.

## 1. Khởi tạo cấu hình

Chạy tại gốc repo mới:

```bash
node scripts/ai/ai-setup.mjs --init
```

Lệnh đọc tên, package manager và commands hiện có từ `package.json`. Manifest version 1 chỉ được
tạo khi chưa có; cấu hình đang tồn tại được giữ nguyên. Nếu chưa khai báo package manager, mặc định
là npm; người bảo trì cần kiểm tra lựa chọn này.

## 2. Khai báo rules riêng của dự án mới

Ví dụ cấu hình `.ai/project.json`:

```json
{
  "version": 1,
  "name": "Orders API",
  "rules": ["docs/backend-contract.md"],
  "skillSources": [],
  "commands": {
    "lint": "npm run lint",
    "test": "npm test",
    "build": "npm run build"
  }
}
```

Chỉ khai báo đường dẫn thực sự tồn tại. Giữ `skillSources: []` để dùng skills mặc định, hoặc trỏ tới
nguồn skills riêng dưới `.ai/` (thường là `.ai/skills/`); không lấy thư mục client làm nguồn.

Contract của dự án mới cần mô tả feature roots, ORM, auth/quyền, ownership, response/errors, nghiệp vụ,
events và tests thực tế. Setup không suy đoán các quyết định này. Nếu có `AGENTS.md`, thêm core index
vào phần cần đọc; nếu chưa có, setup tạo entry nhỏ tại gốc để đưa vào Git.

## 3. Cài và kiểm tra

Thêm hai mục vào `scripts` của `package.json`, không cần dependency mới:

```json
{
  "ai:setup": "node scripts/ai/ai-setup.mjs",
  "ai:check": "node scripts/ai/ai-setup.mjs --check"
}
```

Chạy hai lệnh trên; kết quả mong đợi là `AI setup complete` và `AI check passed`. Review rồi commit
nguồn, ignore rules và entry gốc. Member tiếp theo làm theo hướng dẫn setup của dự án mới.
Có thể mang thêm `scripts/ai/ai-setup.test.mjs` để giữ các kiểm tra portability/conflict của công cụ.


Xem [nguồn rules](../ai-development.md) để phân biệt core dùng chung và contract riêng của dự án.
