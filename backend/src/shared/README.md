# `backend/src/shared/`

Infrastructure and cross-feature code that feature modules depend on. Feature
modules import **from here**; they never import from each other.

Target layout (see `docs/FEATURE_REDO_PLAYBOOK.md` §9):

```
shared/
  middleware/   auth (authenticate), rbac (requireRole), error handler
  config/       prisma client, redis, BullMQ queues, firebase, sentry
  sockets/      socket handlers + the emit service
  jobs/         BullMQ job definitions
  utils/        pure helpers (no I/O, no Prisma)
  types/        types shared across more than one feature
```

Migration is incremental. Today these concerns still live in the flat
`../middleware/`, `../config/`, `../sockets/`, `../jobs/`, `../utils/`,
`../types/` directories. Move a piece here when a redone feature is the first to
need it in the new structure — not in a big-bang pass.

_Empty until the first feature (Inventory) is redone._
