# `backend/src/modules/`

New and redone features live here, **one directory per feature**, with every
layer co-located:

```
modules/<feature>/
  <feature>-routes.ts        Express router — authenticate + requireRole on every route
  <feature>-controller.ts    HTTP in/out only; no business logic
  <feature>-service.ts       business logic; a prisma.$transaction is allowed here,
                             plain reads/writes are not
  <feature>-repository.ts    all Prisma access; every query includes organizationId
  <feature>-validators.ts    Zod schemas for every endpoint's input
  <feature>.types.ts         feature-local types
  <feature>-service.test.ts  (and sibling tests as needed)
```

Rules (see `docs/CODING_STANDARDS.md` §4 and `docs/FEATURE_REDO_PLAYBOOK.md` §9):

- **No `prisma` import outside `<feature>-repository.ts`.** A `$transaction` in
  the service is the only exception.
- **No cross-module imports** between feature modules except through a module's
  public entry point. Shared code goes in `../shared/`.
- Wire each module's routes into `../routes/index.ts` — the one shared
  touch-point.

The legacy layer-grouped code (`../controllers/`, `../services/`,
`../repositories/`, `../validators/`) is **not** migrated wholesale — each
feature moves here as part of its own redo, never as a separate refactor.

_Empty until the first feature (Inventory) is redone._
