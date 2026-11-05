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
AuthApiModule
AccountModule, UsersModule, PartiesModule, CatalogModule
DebtsModule, PaymentsModule, DashboardModule, ReportsModule
ExportsModule, ImportsModule, AuditLogsModule
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

Folders are owned by business domain. A domain can have different route policies or background adapters:

```txt
src/modules/auth       -> login API
src/modules/account   -> current user API
src/modules/dashboard -> dashboard API
src/modules/debts     -> debts API
src/modules/parties   -> parties API
src/modules/payments  -> payments API
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
src/auth/guards/jwt-auth.guard.ts
src/auth/decorators/auth-api.decorator.ts
src/auth/decorators/public.decorator.ts
src/modules/auth/auth.module.ts
src/modules/auth/controllers/account.controller.ts
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
GET http://localhost:<PORT>/api/dashboard
```

Flow:

```txt
HTTP request
  -> src/main.ts
  -> src/configure-app.ts global prefix /api
  -> src/app.module.ts imports DashboardModule
  -> src/modules/dashboard/dashboard.module.ts
  -> src/modules/dashboard/dashboard.controller.ts
  -> src/modules/dashboard/services/dashboard.service.ts
  -> DashboardRepository contract (bound by DashboardModule)
  -> src/modules/dashboard/infrastructure/prisma-dashboard.repository.ts
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
src/modules/dashboard/dashboard.module.ts
```

```ts
@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService, DashboardActionCenterService, PrismaDashboardActionCenter,
    { provide: DashboardRepository, useClass: PrismaDashboardRepository },
  ],
})
export class DashboardModule {}
```

Meaning:

- `DashboardController` receives HTTP requests.
- `DashboardService` validates inputs and orchestrates the query use case.
- `DashboardRepository` is the contract; `PrismaDashboardRepository` owns database projections.

### 3. Controller receives request

File:

```txt
src/modules/dashboard/dashboard.controller.ts
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
src/modules/dashboard/services/dashboard.service.ts
```

```ts
@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly actionCenter: DashboardActionCenterService,
  ) {}

  async get(query: DashboardQueryDto, organizationId: string) {
    requireOrganizationId(organizationId);
    getDashboardPeriod(query);
    const actionCenter = await this.actionCenter.get(query, organizationId);
    const summary = await this.repository.summary(query, organizationId);
    return { ...summary, actionCenter };
  }
}
```

The service calls the repository contract. Its Prisma implementation owns scoped database reads;
the action-center service uses the same contract for its read projection. See
[Persistence architecture](persistence-architecture.md).

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

Because it is global, Prisma adapters can inject `PrismaService`. Application services inject
repository contracts; the architecture gate rejects direct database imports there.

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
  -> src/modules/auth/controllers/auth.controller.ts
  -> LoginDto validation
  -> src/modules/auth/auth.service.ts
  -> Prisma user lookup
  -> bcrypt password compare
  -> JWT access token created
  -> response JSON
```

### 1. Controller

File:

```txt
src/modules/auth/controllers/account.controller.ts
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
src/modules/auth/dto/login.dto.ts
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
src/modules/auth/auth.service.ts
```

Steps:

1. Lowercase email.
2. Call `AuthRepository.findForLogin`; its Prisma adapter selects the login record.
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
src/modules/auth/controllers/account.controller.ts
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
src/auth/guards/jwt-auth.guard.ts
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
src/auth/decorators/current-user.decorator.ts
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
