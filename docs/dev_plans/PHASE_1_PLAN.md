# Phase 1 — Authentication & Branch Setup: Implementation Plan

## Context
Phase 0 delivered a fully configured project skeleton. Phase 1 makes the system functional for the first time: users can log in, every request is authenticated and role-scoped, branches exist, and the app routes each role to its correct interface. This phase is the security and identity foundation that every subsequent phase depends on.

BUILD_ORDER.md spec: lines 222–332. Phase 1 UI is functional but not polished — basic Tailwind utilities only. Full visual styling comes in Phase 1.5.

---

## New Packages Required

**Backend:**
```
pnpm add jsonwebtoken bcryptjs
pnpm add -D @types/jsonwebtoken @types/bcryptjs
```

**Frontend:** No new packages. `jose` for JWT decode in middleware (edge-compatible, already available in Next.js environment via `next`).

---

## Part 1 — Backend

### Step 1 — AppError utility
**File:** `backend/src/utils/errors.ts` (new)

```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) { super(message); }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(401, 'AUTHENTICATION_ERROR', message); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(403, 'AUTHORIZATION_ERROR', message); }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(404, 'NOT_FOUND', message); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super(409, 'CONFLICT', message); }
}
export class ValidationError extends AppError {
  constructor(message: string) { super(400, 'VALIDATION_ERROR', message); }
}
```

Update `backend/src/middleware/error-handler.ts` to catch `AppError` subclasses and Zod errors, returning the standard API envelope.

### Step 2 — Environment variables
**File:** `backend/src/config/env.ts` — add to Zod schema:
- `JWT_ACCESS_SECRET` (string, min 32 chars)
- `JWT_REFRESH_SECRET` (string, min 32 chars)
- `JWT_ACCESS_EXPIRES_IN` (default `'15m'`)
- `JWT_REFRESH_EXPIRES_IN` (default `'7d'`)
- `BCRYPT_ROUNDS` (coerce number, default 12)

Update `backend/.env.example` with these variables.

### Step 3 — JWT utility
**File:** `backend/src/utils/jwt.ts` (new)

Two functions:
- `signAccessToken(payload: { userId, role, organizationId })` → `string`
- `signRefreshToken(payload: { userId })` → `string`
- `verifyAccessToken(token: string)` → `{ userId, role, organizationId }`
- `verifyRefreshToken(token: string)` → `{ userId }`

Use `jsonwebtoken`. Throw `UnauthorizedError` on invalid/expired token.

**Unit test:** `backend/src/utils/jwt.test.ts`
- sign then verify returns correct payload
- tampered token throws UnauthorizedError
- expired token throws UnauthorizedError

### Step 4 — Password utility
**File:** `backend/src/utils/password.ts` (new)

- `hashPassword(plain: string)` → `Promise<string>` (bcryptjs, BCRYPT_ROUNDS from env)
- `comparePassword(plain: string, hash: string)` → `Promise<boolean>`
- Never log the plain text password

**Unit test:** `backend/src/utils/password.test.ts`
- hash then compare returns true
- wrong password returns false

### Step 5 — Seed script
**File:** `backend/src/scripts/seed-admin.ts` (new)

One-time script. Creates the System Admin user if one doesn't exist:
- `email`: from env `SYSTEM_ADMIN_EMAIL`
- `passwordHash`: bcrypt of env `SYSTEM_ADMIN_PASSWORD`
- `role`: SYSTEM_ADMIN
- `organizationId`: null

Add `"seed:admin": "tsx src/scripts/seed-admin.ts"` to package.json scripts.
Add `SYSTEM_ADMIN_EMAIL` and `SYSTEM_ADMIN_PASSWORD` to `env.ts` (optional fields, only needed for seed) and `.env.example`.

### Step 6 — Auth middleware (implement the stubs)

**File:** `backend/src/middleware/authenticate.ts` — replace stub:
- Extract `Authorization: Bearer <token>` header
- Verify with `verifyAccessToken`
- Attach `req.user = { id, role, organizationId }`
- Throw `UnauthorizedError` if missing or invalid

**File:** `backend/src/middleware/rbac.ts` — replace stub:
- `requireRole(...roles: UserRole[])` returns middleware
- Check `req.user.role` is in allowed roles
- Throw `ForbiddenError` if not

**File:** `backend/src/middleware/branch-scope.ts` — replace stub:
- Reads `req.user.organizationId` (already on req.user from JWT)
- No-op middleware for now — organizationId is already available via `req.user`; branch-scoping is enforced in repositories and services

### Step 7 — RefreshToken model
The Prisma schema needs a `RefreshToken` table for secure rotation.

**File:** `backend/prisma/schema.prisma` — add model:
```prisma
model RefreshToken {
  id         String   @id @default(uuid())
  userId     String
  tokenHash  String   @unique   // SHA-256 of the raw token
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  @@index([userId])
}
```
Add `refreshTokens RefreshToken[]` relation on `User`.

Run migration: `pnpm prisma migrate dev --name add_refresh_token`

### Step 8 — Auth feature (repository → service → validator → controller → route)

**Files to create:**
- `backend/src/repositories/auth-repository.ts`
- `backend/src/services/auth-service.ts`
- `backend/src/validators/auth-schemas.ts`
- `backend/src/controllers/auth-controller.ts`
- `backend/src/routes/auth-routes.ts`

#### auth-repository.ts
- `findUserByEmail(email)` → User with passwordHash (only place passwordHash is selected)
- `findUserById(id)` → User without passwordHash
- `saveRefreshToken({ userId, tokenHash, expiresAt })`
- `findRefreshToken(tokenHash)` → RefreshToken | null
- `deleteRefreshToken(tokenHash)`
- `deleteAllUserRefreshTokens(userId)`
- `saveFcmToken(userId, fcmToken)` — store on User (add `fcmToken String?` to schema)

#### auth-service.ts
- `login({ email, password })`:
  1. Find user by email — throw `UnauthorizedError('Invalid credentials')` if not found (do not distinguish)
  2. `comparePassword` — throw same error if wrong
  3. Check `user.isActive` — throw `UnauthorizedError('Account deactivated')`
  4. Sign access token + refresh token
  5. Hash refresh token (SHA-256), save to DB with 7-day expiry
  6. Return `{ accessToken, user: { id, name, email, role, organizationId } }`
  7. Return raw refreshToken separately (for cookie)

- `refresh(rawRefreshToken)`:
  1. Verify refresh token signature → get userId
  2. Hash token, find in DB — throw `UnauthorizedError` if not found/expired
  3. Rotate: delete old token, issue new refresh token, save hash
  4. Sign new access token
  5. Return `{ accessToken }` + new raw refresh token

- `logout(rawRefreshToken)`: delete token hash from DB

- `changePassword({ userId, currentPassword, newPassword })`:
  1. Find user with passwordHash
  2. Compare current password — throw `ValidationError` if wrong
  3. Hash new password, update user

- `registerDevice({ userId, fcmToken })`: save FCM token on user

#### auth-schemas.ts
```ts
LoginSchema: { email: z.string().email(), password: z.string().min(1) }
ChangePasswordSchema: { currentPassword: z.string().min(1), newPassword: z.string().min(8) }
RegisterDeviceSchema: { fcmToken: z.string().min(1) }
```

#### auth-controller.ts
Five handlers: `login`, `refresh`, `logout`, `changePassword`, `registerDevice`

- `login`: parse body → call service → set `refreshToken` as `HttpOnly; Secure; SameSite=Strict` cookie → return 200 with `{ data: { accessToken, user } }`
- `refresh`: read cookie → call service → set new cookie → return 200 with `{ data: { accessToken } }`
- `logout`: read cookie → call service → clear cookie → return 200
- `changePassword`: authenticate required → parse body → call service → return 200
- `registerDevice`: authenticate required → parse body → call service → return 200

#### auth-routes.ts
```
POST   /auth/login            (public)
POST   /auth/refresh          (public — reads cookie)
POST   /auth/logout           (authenticate)
PATCH  /auth/change-password  (authenticate)
POST   /auth/register-device  (authenticate)
```

Rate limit login route: stricter limiter (10 req/min per IP).

---

### Step 9 — Branch feature

**Files to create:**
- `backend/src/repositories/branch-repository.ts`
- `backend/src/services/branch-service.ts`
- `backend/src/validators/branch-schemas.ts`
- `backend/src/controllers/branch-controller.ts`
- `backend/src/routes/branch-routes.ts`

#### branch-repository.ts
- `findAll()` → Organization[]
- `findById(id)` → Organization | null
- `create(data)` → Organization
- `update(id, data)` → Organization
- `setHub(id)` → runs a transaction: unset all `isHub`, set `isHub = true` on given id

#### branch-service.ts
- `listBranches()` → all branches
- `createBranch(data)` → new branch
- `updateBranch(id, data)` → updated branch — throw `NotFoundError` if not found
- `setHubBranch(id)` → throw `NotFoundError` if not found

#### branch-schemas.ts
```ts
CreateBranchSchema: { name, address, city, latitude: z.number(), longitude: z.number() }
UpdateBranchSchema: partial of CreateBranchSchema
```

#### branch-routes.ts
```
GET    /branches              (authenticate, requireRole(DIRECTOR, SYSTEM_ADMIN))
POST   /branches              (authenticate, requireRole(SYSTEM_ADMIN))
PATCH  /branches/:id          (authenticate, requireRole(SYSTEM_ADMIN))
PATCH  /branches/:id/set-hub  (authenticate, requireRole(DIRECTOR, SYSTEM_ADMIN))
```

---

### Step 10 — Staff feature

**Files to create:**
- `backend/src/repositories/staff-repository.ts`
- `backend/src/services/staff-service.ts`
- `backend/src/validators/staff-schemas.ts`
- `backend/src/controllers/staff-controller.ts`
- `backend/src/routes/staff-routes.ts`

#### staff-repository.ts
All queries use `select` to exclude `passwordHash`.
- `findMany({ organizationId?, role?, isActive? })` → User[] (no passwordHash)
- `findById(id, organizationId?)` → User | null (if organizationId provided, scope it)
- `create(data)` → User (no passwordHash in return)
- `update(id, organizationId, data)` → User (no passwordHash)
- `setActive(id, organizationId, isActive: boolean)` → User

#### staff-service.ts
- `listStaff(requestingUser, filters)`:
  - MANAGER: force `organizationId = requestingUser.organizationId`
  - DIRECTOR/SA: use provided filter or all

- `getStaff(id, requestingUser)`:
  - MANAGER: scope to own organizationId
  - DIRECTOR/SA: unrestricted

- `createStaff(data, requestingUser)`:
  - MANAGER: can only create WAITER, CHEF, BARISTA for own branch
  - DIRECTOR/SA: can create MANAGER
  - Hash `temporaryPassword` with `hashPassword`
  - Throw `ConflictError` if email already exists

- `updateStaff(id, data, requestingUser)`:
  - MANAGER: own branch only
  - Cannot change email

- `deactivateStaff(id, requestingUser)`: set isActive = false — MANAGER own branch only
- `reactivateStaff(id, requestingUser)`: set isActive = true

#### staff-schemas.ts
```ts
CreateStaffSchema: { name, email: z.string().email(), phone: z.string().optional(), role: UserRole, temporaryPassword: z.string().min(8), organizationId: z.string().uuid() }
UpdateStaffSchema: { name?: string, phone?: string }
```

#### staff-routes.ts
```
POST   /staff              (authenticate, requireRole(MANAGER, DIRECTOR, SYSTEM_ADMIN))
GET    /staff              (authenticate, requireRole(MANAGER, DIRECTOR, SYSTEM_ADMIN))
GET    /staff/:id          (authenticate, requireRole(MANAGER, DIRECTOR, SYSTEM_ADMIN))
PATCH  /staff/:id          (authenticate, requireRole(MANAGER, DIRECTOR, SYSTEM_ADMIN))
PATCH  /staff/:id/deactivate  (authenticate, requireRole(MANAGER, SYSTEM_ADMIN))
PATCH  /staff/:id/reactivate  (authenticate, requireRole(MANAGER, SYSTEM_ADMIN))
```

### Step 11 — Wire routes into index

**File:** `backend/src/routes/index.ts` — add:
```ts
apiRouter.use(authRoutes)
apiRouter.use(branchRoutes)
apiRouter.use(staffRoutes)
```

### Step 12 — Backend integration tests

**File:** `backend/tests/auth.test.ts`
- POST /auth/login — valid credentials → 200 + accessToken + cookie
- POST /auth/login — wrong password → 401
- POST /auth/login — unknown email → 401
- POST /auth/refresh — valid cookie → 200 + new accessToken
- POST /auth/refresh — missing cookie → 401
- POST /auth/logout — clears cookie
- PATCH /auth/change-password — wrong current password → 400
- POST /auth/register-device → 200

**File:** `backend/tests/branch.test.ts`
- POST /branches — SA creates → 201
- POST /branches — WAITER → 403
- PATCH /branches/:id/set-hub — sets hub, previous hub is unset
- GET /branches — returns list

**File:** `backend/tests/staff.test.ts`
- POST /staff — manager creates WAITER for own branch → 201
- POST /staff — manager creates for another branch → 403
- POST /staff — duplicate email → 409
- GET /staff — manager sees only own branch
- GET /staff — DIRECTOR sees any branch
- PATCH /staff/:id/deactivate — deactivated user cannot log in

---

## Part 2 — Frontend

**Note:** Phase 1 UI is functional but not polished — basic Tailwind utilities only. No design system components yet (those come in Phase 1.5).

### Step 13 — Auth service
**File:** `frontend/services/authService.ts` (new)

```ts
login({ email, password }) → Promise<{ accessToken: string, user: AuthUser }>
logout() → Promise<void>
refreshToken() → Promise<{ accessToken: string }>
changePassword({ currentPassword, newPassword }) → Promise<void>
registerDevice({ fcmToken }) → Promise<void>
```

Uses `apiClient` from `lib/apiClient.ts`.

### Step 14 — Update AuthUser type
**File:** `frontend/types/auth.ts` — add `name` to ensure it matches API response (already present).

### Step 15 — Update authStore
**File:** `frontend/store/authStore.ts` — implement the TODO:
- Add token refresh action: `refreshAccessToken()` — calls `authService.refreshToken()`, updates `accessToken` in store
- Add auto-refresh: schedule refresh 60 seconds before expiry (decode JWT exp claim using `jose` `decodeJwt`)
- On logout: call `authService.logout()` then `clearAuth()`

### Step 16 — Update Next.js middleware
**File:** `frontend/middleware.ts` — implement the two TODOs:
- Import `decodeJwt` from `jose` (edge-compatible, no crypto)
- On authenticated login (`PUBLIC_PATHS` + token): decode JWT role, redirect to `roleHome[role]` instead of hardcoded `/app/dashboard`
- Enforce role-based route authorization: if user is on `/app/manage/*` but role is WAITER, redirect to their `roleHome`

### Step 17 — Login page
**File:** `frontend/app/(auth)/login/page.tsx` — replace placeholder

Functional implementation (basic Tailwind, no design system components yet):
- Email input + Password input
- Submit button with loading state
- On submit: call `authService.login()`, call `useAuthStore.setAuth()`, store token in cookie (`document.cookie`), redirect to `roleHome[role]`
- Inline error: "Invalid email or password" on 401
- Offline detection: if `!navigator.onLine`, show banner

### Step 18 — Profile page
**File:** `frontend/app/app/profile/page.tsx` — replace placeholder

- Display: name, email, role, branch name (fetch from API via `GET /staff/:id` or from authStore)
- Edit form: name, phone (not email)
- Change password section: currentPassword, newPassword, confirm
- Success feedback on save

Add `frontend/services/staffService.ts` for:
- `getMyProfile()` — calls `GET /staff/{userId}`
- `updateMyProfile({ name, phone })` — calls `PATCH /staff/{userId}`

### Step 19 — System Admin page
**File:** `frontend/app/app/admin/page.tsx` — replace placeholder

Tab layout:
1. **Branches tab:**
   - List all branches — name, hub indicator, active status
   - Create branch form (inline or modal): name, address, city, latitude, longitude
   - Edit branch
   - Set hub (with confirmation)

2. **Users tab:**
   - List all Director and Manager accounts
   - Create Director/Manager account form
   - Deactivate/reactivate with confirmation

Add `frontend/services/branchService.ts`:
- `listBranches()`, `createBranch(data)`, `updateBranch(id, data)`, `setHub(id)`

### Step 20 — Manager staff management page
**File:** `frontend/app/app/manage/staff/page.tsx` — replace placeholder

- List all staff at their branch — name, role, status
- Create staff form: name, email, phone, role (WAITER/CHEF/BARISTA), temporaryPassword
- Edit staff details
- Deactivate/reactivate with confirmation

Uses `frontend/services/staffService.ts`:
- `listStaff(filters?)`, `createStaff(data)`, `updateStaff(id, data)`, `deactivateStaff(id)`, `reactivateStaff(id)`

---

## File Creation Summary

### New backend files
| File | Purpose |
|---|---|
| `src/utils/errors.ts` | AppError class hierarchy |
| `src/utils/jwt.ts` | sign/verify JWT tokens |
| `src/utils/jwt.test.ts` | unit tests for JWT |
| `src/utils/password.ts` | hash/compare passwords |
| `src/utils/password.test.ts` | unit tests for password |
| `src/scripts/seed-admin.ts` | System Admin seed |
| `src/validators/auth-schemas.ts` | Zod schemas for auth |
| `src/validators/branch-schemas.ts` | Zod schemas for branches |
| `src/validators/staff-schemas.ts` | Zod schemas for staff |
| `src/repositories/auth-repository.ts` | auth DB queries |
| `src/repositories/branch-repository.ts` | branch DB queries |
| `src/repositories/staff-repository.ts` | staff DB queries |
| `src/services/auth-service.ts` | auth business logic |
| `src/services/branch-service.ts` | branch business logic |
| `src/services/staff-service.ts` | staff business logic |
| `src/controllers/auth-controller.ts` | auth HTTP handlers |
| `src/controllers/branch-controller.ts` | branch HTTP handlers |
| `src/controllers/staff-controller.ts` | staff HTTP handlers |
| `src/routes/auth-routes.ts` | auth route definitions |
| `src/routes/branch-routes.ts` | branch route definitions |
| `src/routes/staff-routes.ts` | staff route definitions |
| `tests/auth.test.ts` | auth integration tests |
| `tests/branch.test.ts` | branch integration tests |
| `tests/staff.test.ts` | staff integration tests |

### Modified backend files
| File | Change |
|---|---|
| `src/config/env.ts` | Add JWT, bcrypt env vars |
| `src/middleware/authenticate.ts` | Implement JWT verification |
| `src/middleware/rbac.ts` | Implement role check |
| `src/middleware/error-handler.ts` | Handle AppError + Zod errors |
| `src/routes/index.ts` | Register new routes |
| `prisma/schema.prisma` | Add RefreshToken model, fcmToken on User |
| `.env.example` | Add new env vars |
| `package.json` | Add seed:admin script |

### New frontend files
| File | Purpose |
|---|---|
| `services/authService.ts` | auth API calls |
| `services/staffService.ts` | staff API calls |
| `services/branchService.ts` | branch API calls |

### Modified frontend files
| File | Change |
|---|---|
| `app/(auth)/login/page.tsx` | Implement login form |
| `app/app/profile/page.tsx` | Implement profile view/edit |
| `app/app/admin/page.tsx` | Implement SA admin UI |
| `app/app/manage/staff/page.tsx` | Implement manager staff UI |
| `store/authStore.ts` | Add refresh + auto-refresh |
| `middleware.ts` | Implement JWT decode + role routing |

---

## Verification

1. `cd backend && pnpm prisma migrate dev --name add_refresh_token` — migration applies cleanly
2. `cd backend && pnpm seed:admin` — System Admin account created
3. `cd backend && pnpm test` — all tests pass (health + auth + branch + staff)
4. `cd backend && pnpm build` — TypeScript compiles with no errors
5. `cd frontend && pnpm typecheck` — no TypeScript errors
6. `cd frontend && pnpm build` — Next.js build succeeds
7. Manual smoke test:
   - Login with System Admin credentials → redirected to `/app/admin`
   - Login as Manager → redirected to `/app/manage/dashboard`
   - Unauthenticated visit to `/app/dashboard` → redirected to `/login`
   - Visit `/app/manage/*` as WAITER → redirected to `/app/dashboard`
