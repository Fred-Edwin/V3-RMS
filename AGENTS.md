# Wendo RMS — Agent Briefing

## What This Project Is

A multi-tenant restaurant management system for Wendo Coffee Bistro,
a premium coffee bistro in Nyeri, Kenya, expanding from 2 to 10 branches.
Stack: Next.js + TypeScript (frontend), Node.js + Express + TypeScript
(backend), PostgreSQL + Prisma, Redis, Socket.io.

## Project Documents — Read ONLY THE SPECIFIED SECTION/LINES of the document Before Acting - Do not read the whole document to avoid wasting tokens.

Before implementing anything, read the document(s) specific sections/lines relevant to your task:

| Document                   | Read When                                      |
| -------------------------- | ---------------------------------------------- |
| `docs/PRD.md`              | Understanding what a feature is supposed to do |
| `docs/DATA_MODEL.md`       | Writing any Prisma schema or database query    |
| `docs/TDD.md`              | Making any architectural decision              |
| `docs/API_CONTRACT.md`     | Implementing any API endpoint                  |
| `docs/DESIGN_SYSTEM.md`    | Building any UI component or page              |
| `docs/BUILD_ORDER.md`      | Understanding what phase is being built        |
| `docs/CODING_STANDARDS.md` | Writing any code — always                      |
| `docs/context`             | Getting context for the previous phases        |

## Non-Negotiables (Read These Now)

1. TypeScript strict mode is always on. No `any` types.
2. Every API route has `authenticate` and `requireRole` middleware.
3. Every repository query includes `organizationId` in the where clause.
4. Business logic lives in services only — never controllers or repositories.
5. Database queries live in repositories only — never services or controllers.
6. Every endpoint has a Zod schema for input validation.
7. Passwords are never logged, returned in responses, or stored plain text.
8. A feature without tests is not complete.
9. Always use pnpm to install dependencies.
10. Always use pnpm to run scripts.
11. Always use pnpm to build the project.
12. Always use pnpm to run the project.
13. Use Windows PowerShell commands.

## Frontend Hook Stability Rules (Read Before Editing Pages/Hooks)

1. Hooks that return action functions used in `useEffect`/`useCallback` dependencies must return stable references (use selectors + `useCallback` when needed).
2. Do not silence dependency warnings by default. Prefer making dependencies stable instead of removing them.
3. Data-loading effects must not depend on unstable inline functions, or they can trigger repeated refetch loops and UI flicker.
4. For Zustand, prefer selecting specific actions (`useStore((s) => s.action)`) instead of destructuring the whole store object.
5. If you intentionally omit a dependency, add an inline comment explaining why it is safe.

## Project Structure

backend/src/
controllers/ — thin, validate + delegate only
services/ — all business logic
repositories/ — all Prisma queries
middleware/ — auth, rbac, error handler
routes/ — route definitions
validators/ — Zod schemas
sockets/ — Socket.io handlers
jobs/ — BullMQ background jobs
utils/ — pure utility functions
types/ — TypeScript types

frontend/
app/ — Next.js App Router pages
components/ — reusable UI components
ui/ — base components
orders/ — order components
kitchen/ — KDS/BDS components
menu/ — menu components
staff/ — staff components
dashboard/ — dashboard components
hooks/ — custom React hooks
services/ — API call functions
store/ — Zustand stores
lib/ — utilities (apiClient, socket, cn)
types/ — shared TypeScript types

## Current Phase

<!-- UPDATE THIS EVERY TIME A PHASE BEGINS -->

Phase: 3 — Order Management
Status: Complete
Context file: docs/context/PHASE_3_CONTEXT.md
