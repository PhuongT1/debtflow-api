# Request Flow

This guide explains which files run first when a user calls an API.

## App Startup Order

When the backend starts with `npm run dev`, the main flow is:

```txt
package.json
  -> scripts.dev
  -> nest start --watch
  -> src/main.ts
  -> src/app.module.ts
  -> src/configure-app.ts
  -> listen on PORT, default 4000
```

Detailed order:

1. `package.json`
   - `dev` starts NestJS in watch mode.
   - `setup:dev` generates Prisma Client during the initial project setup.

2. `src/main.ts`
   - Creates the Nest app:

```ts
const app = await NestFactory.create(AppModule);
```

3. `src/app.module.ts`
   - Registers all application modules:

```txt
ConfigModule
DatabaseModule
AuthModule
PublicModule
ProtectedModule
```

4. `src/configure-app.ts`
   - Adds global API prefix:

```txt
/api
```

- Enables CORS.
- Enables global validation pipe.
- Registers Prisma exception filter.
- Registers Swagger:

```txt
/docs
/docs-json
```

5. Nest scans every module and connects controllers to routes.

## Public vs Protected APIs

Folders are split by auth boundary first, then by business domain:

```txt
src/modules/public/auth       -> login API
src/modules/protected/account   -> current user API
src/modules/protected/dashboard -> dashboard API
src/modules/protected/debts     -> debts API
src/modules/protected/parties   -> parties API
src/modules/protected/payments  -> payments API
```

Authentication is visible in each controller:

```txt
@PublicApi()  -> does not require login
@ProtectedApi() -> requires Authorization: Bearer <accessToken>
```

The real protection is enforced globally by `JwtAuthGuard`, but the decorators make the source easy to scan.

Files:

```txt
src/auth/auth.module.ts
src/auth/jwt-auth.guard.ts
src/auth/auth-api.decorator.ts
src/auth/public.decorator.ts
src/modules/public/public.module.ts
src/modules/public/auth/auth.module.ts
src/modules/protected/protected.module.ts
src/modules/protected/account/account.module.ts
```

Current split:

| API                    | Auth      |
| ---------------------- | --------- |
| `POST /api/auth/login` | Public    |
| `GET /api/auth/me`     | Protected |
| `GET /api/dashboard`   | Protected |
| `/api/debts/**`        | Protected |
| `/api/parties/**`      | Protected |
| `/api/payments/**`     | Protected |
| `/api/users/**`        | Protected |
| `/api/reports/**`      | Protected |
| `/api/exports/**`      | Protected |
| `/api/imports/**`      | Protected |
| `/api/audit-logs/**`   | Protected |

## Example: `GET /api/dashboard`

The request URL:

```txt
GET http://localhost:4000/api/dashboard
```

Flow:

```txt
HTTP request
  -> src/main.ts
  -> src/configure-app.ts global prefix /api
  -> src/app.module.ts imports DashboardModule
  -> src/modules/protected/dashboard/dashboard.module.ts
  -> src/modules/protected/dashboard/dashboard.controller.ts
  -> src/modules/protected/dashboard/dashboard.service.ts
  -> src/database/prisma.service.ts
  -> PostgreSQL / Neon database
  -> response JSON
```

### 1. App module loads dashboard module

File:

```txt
src/app.module.ts
```

```ts
imports: [DashboardModule];
```

This makes the dashboard controller and service available.

### 2. Dashboard module wires controller and service

File:

```txt
src/modules/protected/dashboard/dashboard.module.ts
```

```ts
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

Meaning:

- `DashboardController` receives HTTP requests.
- `DashboardService` contains business/query logic.

### 3. Controller receives request

File:

```txt
src/modules/protected/dashboard/dashboard.controller.ts
```

```ts
@Controller('dashboard')
export class DashboardController {
  constructor(protected readonly dashboardService: DashboardService) {}

  @Get()
  get() {
    return this.dashboardService.get();
  }
}
```

Route result:

```txt
Global prefix: /api
Controller:    /dashboard
Method:        GET /
Final route:   GET /api/dashboard
```

The controller does not query the database directly. It calls:

```ts
this.dashboardService.get();
```

### 4. Service runs business/query logic

File:

```txt
src/modules/protected/dashboard/dashboard.service.ts
```

```ts
@Injectable()
export class DashboardService {
  constructor(protected readonly prisma: PrismaService) {}

  async get() {
    const [debts, recentPayments, topDebts] = await Promise.all([
      this.prisma.debt.findMany(...),
      this.prisma.payment.findMany(...),
      this.prisma.debt.findMany(...),
    ]);

    return {
      receivable,
      payable,
      overdueCount,
      recentPayments,
      topDebts,
    };
  }
}
```

The service uses `PrismaService` to read data from the database.

### 5. Prisma service connects to database

Files:

```txt
src/database/database.module.ts
src/database/prisma.service.ts
```

`DatabaseModule` is global:

```ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

Because it is global, feature services can inject `PrismaService`.

`PrismaService` extends generated Prisma Client:

```ts
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      adapter: new PrismaPg(databaseUrl),
    });
  }
}
```

Database URL comes from:

```txt
.env -> DATABASE_URL
```

### 6. Response returns to user

The returned object from `DashboardService.get()` becomes JSON response.

## Is Dashboard Authenticated?

Yes. `GET /api/dashboard` requires login.

Reason: auth is registered globally, so every route is protected by default.

Global guard registration:

```txt
src/auth/auth.module.ts
```

```ts
providers: [
  AuthService,
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
];
```

Because of this, dashboard requests must include:

```txt
Authorization: Bearer <accessToken>
```

If a route should be public, mark it with:

```ts
@PublicApi()
```

Public routes are the exception, not the default.

## Auth Flow: Login

Login route:

```txt
POST /api/auth/login
```

Flow:

```txt
HTTP request
  -> src/modules/public/auth/auth.controller.ts
  -> LoginDto validation
  -> src/auth/auth.service.ts
  -> Prisma user lookup
  -> bcrypt password compare
  -> JWT access token created
  -> response JSON
```

### 1. Controller

File:

```txt
src/modules/protected/account/account.controller.ts
```

```ts
@PublicApi()
@Post("login")
login(@Body() body: LoginDto) {
  return this.authService.login(body);
}
```

Final route:

```txt
POST /api/auth/login
```

### 2. DTO validation

File:

```txt
src/modules/public/auth/dto/login.dto.ts
```

Only these fields are allowed:

```txt
email
password
```

Because global validation uses:

```ts
whitelist: true;
forbidNonWhitelisted: true;
```

Unknown fields are rejected.

### 3. Service authenticates user

File:

```txt
src/auth/auth.service.ts
```

Steps:

1. Lowercase email.
2. Find user by email with Prisma.
3. If user/passwordHash missing, throw `UnauthorizedException`.
4. If user status is not active, throw `UnauthorizedException`.
5. Compare password with `bcrypt.compare`.
6. Sign JWT with `JwtService`.
7. Return:

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

## Auth Flow: Protected Route

Example protected route:

```txt
GET /api/auth/me
```

File:

```txt
src/modules/protected/account/account.controller.ts
```

```ts
@ProtectedApi()
@Get("me")
me(@CurrentUser() user: JwtAuthPayload) {
  return this.authService.getCurrentUser(user.sub);
}
```

Flow:

```txt
HTTP request
  -> global JwtAuthGuard
  -> extract Bearer token
  -> verify JWT using JWT_SECRET
  -> attach payload to request.user
  -> CurrentUser decorator reads request.user
  -> controller calls authService.getCurrentUser(user.sub)
  -> Prisma fetches user
  -> response JSON
```

### Guard

File:

```txt
src/auth/jwt-auth.guard.ts
```

The guard checks:

```txt
Authorization: Bearer <token>
```

If token is missing:

```txt
401 Thiếu Bearer token.
```

If token is invalid or expired:

```txt
401 Token không hợp lệ hoặc đã hết hạn.
```

### CurrentUser decorator

File:

```txt
src/auth/current-user.decorator.ts
```

It reads:

```ts
request.user;
```

That value was attached by `JwtAuthGuard`.

## Error Flow

### Validation errors

Configured in:

```txt
src/configure-app.ts
src/common/validation/validation-exception.factory.ts
```

Example:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ.",
  "errors": [
    {
      "field": "email",
      "message": "Vui lòng nhập email.",
      "code": "AUTH_EMAIL_REQUIRED"
    }
  ],
  "timestamp": "2026-08-18T08:30:00.000Z",
  "path": "/api/auth/login"
}
```

### Prisma errors

Handled by:

```txt
src/common/filters/api-exception.filter.ts
```

Common examples:

- Duplicate email -> conflict response.
- Missing Prisma record -> not found response.
- Relation conflict -> conflict response.
- Other Prisma known request errors -> bad request response.

Successful controller results are wrapped by:

```txt
src/common/interceptors/api-response.interceptor.ts
```

See [API Response Format](api-response-format.md) for the complete response contracts.
