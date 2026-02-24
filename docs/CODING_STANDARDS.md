# Coding Standards
## Wendo RMS
Version: 1.1 (condensed)

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
- `controllers/` thin: parse/validate/delegate/respond.
- `services/` business rules and orchestration.
- `repositories/` Prisma queries only.
- `validators/` Zod schemas.
- `routes/` middleware + route wiring only.
- `middleware/` auth/rbac/error handling.
- `sockets/` socket handlers + emit service.
- `utils/` pure helpers.
- `types/` shared TS types.

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

---

## 6) Prisma and Data Rules
- Decimal/currency values must remain precise (do not use floating-point math for persisted monetary values).
- Migrations are required for schema changes.
- Prefer transactions for multi-write operations that must be atomic.
- Soft-delete behavior must be consistent where used.

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
### Canonical frontend layout
- `app/` routes/layouts.
- `components/` reusable feature components.
- `ui/` base primitives.
- `hooks/` custom hooks.
- `services/` API calls.
- `store/` Zustand stores.
- `types/` TS contracts.
- `lib/` utilities (`apiClient`, `socket`, env helpers).

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
- UI follows design system tokens/components.
