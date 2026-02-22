# Wendo RMS Backend (Phase 0)

## Local setup

1. Install dependencies:

```powershell
pnpm install
```

2. Copy environment file and set real values:

```powershell
Copy-Item .env.example .env
```

3. Validate Prisma schema:

```powershell
pnpm prisma validate
```

4. Generate Prisma client:

```powershell
pnpm prisma:generate
```

5. Run API in dev mode:

```powershell
pnpm dev
```

## Verification

- Health endpoint: `GET http://localhost:4000/api/v1/health`
- Tests:

```powershell
pnpm test
```

- Socket join-room manual check:

```powershell
pnpm socket:test-client
```

## Cloud handoff pending

- Supabase migration apply and table/index verification
- Upstash Redis live ping verification
- Render staging/prod environment variable configuration
- Staging socket connectivity verification
