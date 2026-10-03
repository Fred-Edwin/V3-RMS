# `backend/src/modules/`

Redone features live here, **one directory per feature**. A feature with several
workflows is split into sub-modules; each sub-module co-locates every layer:

```
modules/<feature>/
  _shared/                   helpers used by several sub-modules
  <sub>/
    README.md                spec, status, endpoints, coupling — keep current
    <sub>-routes.ts          authenticate + requireRole on every route
    <sub>-controller.ts      HTTP in/out only; no business logic
    <sub>-service.ts         business logic; a prisma.$transaction is allowed here
    <sub>-repository.ts      all Prisma access; every query includes organizationId
    <sub>-validators.ts      Zod schemas for every endpoint's input
    <sub>.types.ts
    *.test.ts                tests beside the code
```

Current modules: [`inventory/`](inventory/) (11 sub-modules; map and status in
`docs/features/inventory/README.md`).

Rules (see `docs/CODING_STANDARDS.md` §4 and `docs/FEATURE_REDO_PLAYBOOK.md` §9):

- **No `prisma` import outside `*-repository.ts`.** A `$transaction` in the service is the only exception.
- **Sub-modules do not reach into each other's internals** except where the README's *Coupling* section lists it. Shared code goes in `_shared/` (within a feature) or `../shared/` (across features).
- Wire each router in `../routes/index.ts` — the one shared touch-point.
- Every sub-module has a README; behaviour changes update it in the same commit.

The legacy layer-grouped code (`../controllers/`, `../services/`, `../repositories/`,
`../validators/`) is not migrated wholesale: each feature moves here as part of its own
redo, never as a separate refactor.
