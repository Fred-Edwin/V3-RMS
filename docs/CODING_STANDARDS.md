# Coding Standards
## Wendo RMS
Version: 1.2 (condensed; layout updated 2026-10-03)

This file is intentionally brief. It defines enforceable rules only.

---

## 1) Non-Negotiables
1. TypeScript strict mode is required. No `any`.
2. Every protected API route must use `authenticate` and `requireRole`.
3. Multi-tenant safety: every repository query must scope by `organizationId`.
4. Business logic belongs in services only.
5. Database access belongs in repositories only.
6. Every endpoint input must have a Zod schema.
7. Passwords are never logged, returned, or stored in plain text.
8. A feature is incomplete without tests.

---

## 2) TypeScript Rules
- `strict: true` must stay enabled.
- Prefer `unknown` + narrowing over `any`.
- Use explicit return types in service/repository functions.
- Handle null/undefined explicitly; avoid non-null assertions (`!`).
- Use string unions for app/domain states when possible.

---

## 3) Naming Rules
- Files/folders: `kebab-case`.
- React components/types/interfaces: `PascalCase`.
- Variables/functions/methods/hooks: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE`.
- Boolean names: `is/has/can/should` prefix.
- Handlers: `handleX`.

---

## 4) Backend Structure and Boundaries
### Canonical backend layout

New and redone features live in `backend/src/modules/<feature>/`, split into
**sub-modules** by what the user does. Full target tree and rules:
`docs/FEATURE_REDO_PLAYBOOK.md` §9.

```
modules/<feature>/
  _shared/            helpers used by several sub-modules
  <sub>/
    README.md         spec + status + endpoints + coupling (kept current)
    <sub>-routes.ts   router: authenticate + requireRole on every route
    <sub>-controller.ts  thin: parse/validate/delegate/respond
    <sub>-service.ts  business rules; a prisma.$transaction is allowed here
    <sub>-repository.ts  Prisma only; every query scoped by organizationId
    <sub>-validators.ts  Zod schemas
    <sub>.types.ts
    *.test.ts         beside the code
shared/               middleware, config, sockets, jobs, utils, types
routes/index.ts       wires every module's routes
```

The old layer-grouped folders (`controllers/ services/ repositories/ validators/`)
hold **not-yet-redone** features only. A feature moves into `modules/` as part of
its own redo, never as a separate refactor.

- Files keep layer-suffixed names (greppable); the folder carries the area.
- A sub-module imports another sub-module's internals only where its README's
  *Coupling* section lists it. New cross-sub-module needs go through the owner's exports.
- Every sub-module has a `README.md`; behaviour changes update it in the same commit.
- Pure restructures (moving files) change no behaviour: backend build, tests and a
  registered-route diff must be identical before and after.

### Controller rules
- Must parse params/query/body with Zod.
- Must not contain business logic.
- Must not call Prisma directly.
- Must not transform auth/tenant rules ad hoc (use middleware + services).

### Service rules
- Must enforce business rules and permissions.
- Must call repositories; never call Prisma directly.
- Must throw typed app errors (`ValidationError`, `ConflictError`, `NotFoundError`, etc.).
- Must keep side effects after DB commits where relevant.

### Repository rules
- Prisma-only layer.
- Every tenant-scoped query must include `organizationId`.
- Return typed DTOs/records expected by services.
- No business decision logic in repositories.

---

## 5) Validation and Error Handling
### Zod
- Each endpoint has request schemas for body/query/params.
- Parse before service invocation.
- Validation failures return 4xx via global handler.

### Errors
- Use centralized typed errors with HTTP status mapping.
- Never leak stack traces/internal details to clients.
- Log useful context, never secrets.
- Use `mapPrismaError(error, { conflict?: string, notFound?: string })` from `utils/prisma-errors.ts` in service catch blocks to convert Prisma errors to domain errors. Only use inline catch logic when custom behavior is required (e.g. returning an existing record on conflict).
- `P2025` (record not found on update) is handled globally — do not catch it per-service.

---

## 6) Prisma and Data Rules
- Decimal/currency values must remain precise (do not use floating-point math for persisted monetary values).
- Migrations are required for schema changes.
- Prefer transactions for multi-write operations that must be atomic.
- Soft-delete behavior must be consistent where used.
- Every repository mutation must include `organizationId` in the `where` clause for tenant-scoped models. Use `updateMany` (not `update`) when scoping by both `id` and `organizationId`.
- Route params must be validated with Zod UUID schemas before reaching service layer — never use raw string extraction or custom `requireRouteId()` helpers.

---

## 7) WebSocket Rules
- Event names should be domain-scoped and stable (e.g., `order:new`, `order:claimed`).
- Join logic must validate payloads and authorization.
- Emit events after successful commit, not mid-transaction.
- Keep emit orchestration in socket service/helper, not scattered.

---

## 8) Testing Rules
### Required levels
- Unit tests for pure logic and service rules.
- Integration tests for routes/controllers and critical workflows.

### Must cover
- Happy path and permission failures (403/401).
- Validation failures (400).
- Conflict/business rule failures (409 where applicable).
- Tenant isolation behavior.

---

## 9) Frontend Structure and Rules
### Canonical frontend layout — feature modules

Redone features are **grouped by feature**, mirroring `backend/src/modules/`, and
split into sub-modules the same way. See `FEATURE_REDO_PLAYBOOK.md` §9.

```
frontend/
  app/                      ROUTING ONLY — thin page shells
  features/<feature>/
    index.ts                public API — other features import only this
    _shared/                components/hooks/lib shared across the feature's sub-modules
    <sub>/
      components/  hooks/  lib/  services/  store/  types/
  components/
    ui/                     OLD design system — frozen, retired per feature
    ui2/                    NEW primitives on the design tokens
    app/shell/              cross-feature shell and generic states
  hooks/ services/ store/ types/   LEGACY + genuinely cross-feature only
  lib/                      apiClient, socket, cn, tokens
```

### Feature module rules
- **`app/` pages hold routing concerns only** — params, metadata, layout choice,
  and rendering a feature component. No data fetching, business logic or feature state.
- **No cross-feature deep imports.** `features/a/` imports `features/b`'s `index.ts`,
  never `features/b/<sub>/...`. Shared code goes in `lib/`, `components/ui2/`,
  `components/app/`. Within a feature, a sub-module uses `_shared/` freely and reaches
  into another sub-module only where it is listed as coupling.
- **A feature's `index.ts` is its public API.** (Inventory currently has deep imports
  from `app/` pages that should move to the index; tracked as follow-up.)
- **Migrate per feature, as part of its redo.** Not-yet-redone features keep using the
  legacy `hooks/ services/ store/ types/` folders.
- Screen-building rules (states, shells, tables, fidelity checks): `docs/UI_BUILD_RULES.md`.

### Component rules
- Keep components focused and composable.
- Side effects belong in hooks/effects, not render paths.
- Show loading, empty, and error states explicitly.

### Zustand/hook stability
- Select specific store slices/actions (`useStore((s) => s.x)`).
- Avoid destructuring full stores in components.
- Keep effect dependencies correct; make callbacks stable with `useCallback` when needed.
- Do not silence dependency warnings without documented justification.

### API service rules
- Centralize fetch logic in `apiClient`.
- Service functions should be typed and minimal.
- Surface backend errors as typed client errors; UI must handle failures gracefully (no unhandled runtime crashes).

---

## 10) Styling and Design System
- Use design tokens and patterns from `docs/DESIGN_SYSTEM.md`.
- No ad hoc styling that breaks token consistency.
- Prefer utility classes over inline styles; inline styles allowed only for unavoidable platform constraints.
- Build mobile-first.

---

## 11) Security and Privacy
- Never log secrets, tokens, passwords, or full credentials payloads.
- Enforce least privilege by role.
- Keep auth/session flows deterministic and explicit.

---

## 12) Git and PR Rules
- Small, focused changes.
- Clear commit messages.
- No unrelated refactors mixed into feature PRs.
- PR must include:
  - What changed
  - Why
  - Test evidence
  - Risk notes

---

## 13) Review Checklist (Fast)
- Architecture boundaries respected (controller/service/repository).
- Route auth + role checks present.
- Tenant scoping (`organizationId`) present in repository queries.
- Zod validation present for endpoint inputs.
- Typed errors and safe messages used.
- No `any`, no unsafe null assertions.
- Tests added/updated for changed behavior.
- Frontend has loading/error/empty states and no unhandled API errors.
- UI follows design system tokens/components and `docs/UI_BUILD_RULES.md`.
- Sub-module README updated if behaviour, endpoints or status changed.
