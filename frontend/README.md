# Wendo RMS Frontend (Phase 0)

## Setup

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

## Validation

```powershell
pnpm lint
pnpm typecheck
pnpm build
```

## Included in Phase 0
- Next.js 14 App Router scaffold
- Tailwind theme aligned to Design System Section 13
- Route placeholders for auth, staff, manager, director, and admin flows
- Middleware skeleton for auth route protection
- `apiClient` skeleton in `lib/apiClient.ts`
- Socket.io client skeleton in `lib/socket.ts`
- Zustand auth store scaffold in `store/authStore.ts`

## Pending Cloud Tasks
- Connect repository to Vercel for auto-deploy on push
- Configure staging environment and variables
- Verify staging deployment and route accessibility
