# Build Order
## Wendo Coffee Bistro — Restaurant Management System (RMS)
**Version:** 2.0
**Status:** Current
**Date:** 2026-05-04
**Author:** System Architect

---

## Table of Contents

1. [Principles](#1-principles)
2. [Testing Strategy](#2-testing-strategy)
3. [Definition of Done](#3-definition-of-done)
4. [Phase Overview](#4-phase-overview)
5. [Phase 0 — Project Foundation](#5-phase-0--project-foundation)
6. [Phase 1 — Authentication & Branch Setup](#6-phase-1--authentication--branch-setup)
7. [Phase 1.5 — Design System & Component Library](#7-phase-15--design-system--component-library)
8. [Phase 2 — Menu Management](#8-phase-2--menu-management)
9. [Phase 3 — Order Management](#9-phase-3--order-management)
10. [Phase 4 — Delivery Zones](#10-phase-4--delivery-zones)
11. [Phase 5 — Staff Management](#11-phase-5--staff-management)
12. [Phase 6 — Reporting & Dashboards](#12-phase-6--reporting--dashboards)
13. [Phase 7 — Credit Accounts](#13-phase-7--credit-accounts)
14. [Phase 8 — Operations Expansion](#14-phase-8--operations-expansion)
15. [Dependency Map](#15-dependency-map)

---

## 1. Principles

**Build vertically, not horizontally.** For every feature, build the complete slice — database migration, repository, service, controller, API route, and UI — before moving to the next feature. Never build all database tables first, then all APIs, then all UI. That approach means nothing works until everything is done.

**Build in dependency order.** Nothing is built before the thing it depends on. Orders depend on menu items. Reports depend on order data. Auth underlies everything. The design system underlies every UI screen. The sequence below reflects these dependencies strictly.

**Deploy after every phase.** Each completed phase is deployed to the staging environment and verified working before the next phase begins. This creates continuous checkpoints, catches integration problems early, and gives stakeholders real visibility into progress.

**A feature is not done until it is tested.** Tests are written within each phase, not after all phases are complete. A feature without tests is considered incomplete.

**Simple before complex.** Within each phase, build the simpler features before the complex ones. This ensures the foundation of each phase is solid before the harder parts are tackled.

**Design before you build UI.** No UI screen is built before the design system and component library exist. Components are composed from the library — never styled from scratch per-screen.

---

## 2. Testing Strategy

### Test Types

**Integration Tests — Primary**
Every API endpoint gets an integration test. These tests make real HTTP requests against a test database, verify the response shape, and confirm the database state after the operation. This is the highest-value test type for our system because our complexity lives in how the layers interact.

**Unit Tests — For Complex Logic**
Pure business logic functions that have no external dependencies get unit tests. These include:
- Haversine distance calculation
- Order total and subtotal calculation
- Daily order number generation logic
- PrepTicket routing logic (which items go to which station)
- Report metric calculations

**No E2E Tests in V1**
End-to-end browser tests are valuable but expensive to write and maintain. Integration tests provide 80% of the protection at 20% of the cost. E2E testing will be introduced in V2 when the system is stable and the UI is finalised.

### Testing Stack
- **Vitest** — test runner for both unit and integration tests (TypeScript-native, fast)
- **Supertest** — HTTP assertion library for integration tests
- **Prisma test database** — a separate test PostgreSQL instance, reset between test runs

### Test File Convention
```
backend/src/
  services/
    orderService.ts
    orderService.test.ts         <- unit tests for order service logic
  controllers/
    orderController.test.ts      <- integration tests for order endpoints
  utils/
    haversine.ts
    haversine.test.ts            <- unit tests for haversine utility
```

---

## 3. Definition of Done

A phase is considered **complete** when every item in the phase checklist is satisfied:

- [ ] All database migrations are written and applied to staging
- [ ] All API endpoints for the phase are implemented
- [ ] All API endpoints have integration tests — all passing
- [ ] All complex business logic has unit tests — all passing
- [ ] All UI screens for the phase are built and functional
- [ ] All UI screens use design system components — no ad-hoc styles
- [ ] The phase is deployed to staging
- [ ] The deployed staging version is manually verified end-to-end
- [ ] No known bugs are left unresolved from this phase

---

## 4. Phase Overview

| Phase | Name | What It Delivers | Depends On | Status |
|---|---|---|---|---|
| 0 | Project Foundation | Working skeleton — nothing functional yet, everything configured | Nothing | ✅ Complete |
| 1 | Auth & Branch Setup | Login, role-based routing, branch and staff management, profile page | Phase 0 | ✅ Complete |
| 1.5 | Design System & Component Library | Complete component library — used by all subsequent UI phases | Phase 1 | ✅ Complete |
| 2 | Menu Management | Full menu CRUD, branch availability, Cloudinary image upload | Phase 1.5 | ✅ Complete |
| 3 | Order Management | Complete order lifecycle. Waiter, Chef, Barista dashboards and order history. Receipt printing. | Phase 2 | ✅ Complete |
| 3.5 | Navigation & Shell Polish | Fully wired navigation, logout, layout shells, FCM web push, premium design polish across all roles | Phase 3 | ✅ Complete |
| 4 | Delivery Zones | Delivery zone config, delivery order flow end-to-end | Phase 3.5 | ✅ Complete |
| 5 | Staff Management | Shift scheduling, geofencing clock-in/out, staff shifts page | Phase 1.5 | ✅ Complete |
| 6 | Reporting & Dashboards | Manager and Director dashboards, personal performance pages, exports | Phase 3.5, Phase 5 | ✅ Complete |
| 7 | Credit Accounts | House accounts, corporate accounts, customer credit, outstanding balances report | Phase 6 | ✅ Complete |
| 8 | Operations Expansion | Other income, HR module, internal communications, discounts (staff + customer), incident log improvements | Phase 7 | ✅ Complete |
| 9 | Payslip Visibility | Staff payslip self-service portal, admin payslip management, PDF export | Phase 8 | 🔲 Planned |

---

## 5. Phase 0 — Project Foundation

**Goal:** A fully configured, deployable project skeleton. No business features yet — but every tool, connection, and pipeline is in place so development can begin cleanly.

This phase has no UI beyond placeholder pages. Its output is invisible to end users but critical to every developer.

---

### Backend

#### Project Setup
- [ ] Initialise Node.js + Express + TypeScript project
- [ ] Configure tsconfig.json with strict mode enabled
- [ ] Configure eslint and prettier for consistent code style
- [ ] Set up folder structure as defined in TDD Section 5

#### Database
- [ ] Connect Prisma to PostgreSQL (Docker container in local dev; DigitalOcean droplet in production)
- [ ] Write initial schema.prisma with all models from the Data Model document
- [ ] Run initial migration — creates all tables
- [ ] Confirm all tables, indexes, and constraints are created correctly

#### Redis
- [ ] Connect to Redis (Docker container in local dev; DigitalOcean droplet in production)
- [ ] Verify connection with a simple ping test
- [ ] Set up Redis client singleton in config/redis.ts

#### Express Server
- [ ] Create Express app with JSON body parsing
- [ ] Set up global error handling middleware
- [ ] Set up request logging middleware (Pino)
- [ ] Set up CORS configuration (allow Vercel frontend domain)
- [ ] Set up rate limiting middleware
- [ ] Create /health endpoint — returns database and Redis connectivity status
- [ ] Set up response compression (gzip)

#### Socket.io
- [ ] Attach Socket.io to the Express HTTP server
- [ ] Set up branch room structure
- [ ] Verify a test client can connect and join a room

#### BullMQ
- [ ] Configure BullMQ queues (notificationQueue, reportQueue) backed by Redis
- [ ] Set up job processor skeleton (no actual jobs yet)

#### Environment Configuration
- [ ] Create .env.example with all required variables documented
- [ ] Configure environment variables (local .env, DigitalOcean server, Vercel)
- [ ] Confirm all connections work in the local Docker environment

---

### Frontend

#### Project Setup
- [ ] Initialise Next.js 14 (App Router) + TypeScript project
- [ ] Install and configure Tailwind CSS with the full theme from DESIGN_SYSTEM.md Section 13
- [ ] Install and configure Zustand
- [ ] Install and configure fetch wrapper for API calls
- [ ] Install lucide-react for icons
- [ ] Set up Google Fonts — Cormorant Garamond and DM Sans in layout.tsx
- [ ] Set up folder structure as defined in TDD Section 5

#### Routing Shell
- [ ] Create route group structure: (auth) and app
- [ ] Create placeholder pages for all role routes:
  - /login
  - /app/dashboard (waiter, chef, barista — role-aware)
  - /app/orders (waiter active orders)
  - /app/orders/new (waiter create order)
  - /app/history (waiter, chef, barista)
  - /app/performance (waiter, chef, barista)
  - /app/shifts (waiter, chef, barista)
  - /app/clock (waiter, chef, barista)
  - /app/profile (all roles)
  - /app/kitchen (chef / KDS)
  - /app/barista (barista / BDS)
  - /app/manage/dashboard (manager)
  - /app/manage/staff (manager)
  - /app/manage/menu (manager)
  - /app/manage/shifts (manager)
  - /app/manage/delivery-zones (manager)
  - /app/manage/reports (manager)
  - /app/director (director)
  - /app/admin (system admin)
- [ ] Create Next.js middleware for auth-based route protection (skeleton only)

#### Socket.io Client
- [ ] Install Socket.io client
- [ ] Create lib/socket.ts — socket initialisation, connection management skeleton

---

### CI/CD
- [ ] Connect GitHub repository to GitHub Actions for backend CI/CD (build → push Docker image → deploy to DigitalOcean)
- [ ] Connect GitHub repository to Vercel (frontend auto-deploy on push to main)
- [ ] Verify full deploy pipeline works: push to main → Actions build → server pulls and restarts containers

---

### Phase 0 Tests
- [ ] /health returns 200 with correct payload
- [ ] Database connection is live on staging
- [ ] Redis connection is live on staging
- [ ] Socket.io accepts a test connection on staging

---

## 6. Phase 1 — Authentication & Branch Setup

**Goal:** Every user can log in. Every request is authenticated and role-scoped. Branches exist in the system. The app routes users to the correct interface. Every user has a profile page.

After this phase: the System Admin can log in, create branches, and create the first Director and Manager accounts. Staff can log in and manage their own profile.

---

### Backend

#### Database
- [ ] Confirm users and organizations tables are ready (from Phase 0 migration)
- [ ] Seed the System Admin account (one-time seed script)

#### Auth Endpoints
- [ ] POST /api/v1/auth/login
- [ ] POST /api/v1/auth/refresh
- [ ] POST /api/v1/auth/logout
- [ ] PATCH /api/v1/auth/change-password
- [ ] POST /api/v1/auth/register-device

#### Auth Middleware
- [ ] authenticate middleware — validates JWT on every protected route
- [ ] requireRole middleware — enforces role-based access per route
- [ ] branchScope middleware — attaches verified organizationId from JWT to req.user

#### Branch Endpoints
- [ ] GET /api/v1/branches
- [ ] POST /api/v1/branches
- [ ] PATCH /api/v1/branches/:id
- [ ] PATCH /api/v1/branches/:id/set-hub

#### Staff Account Endpoints
- [ ] POST /api/v1/staff
- [ ] GET /api/v1/staff
- [ ] GET /api/v1/staff/:id
- [ ] PATCH /api/v1/staff/:id
- [ ] PATCH /api/v1/staff/:id/deactivate
- [ ] PATCH /api/v1/staff/:id/reactivate

---

### Frontend

Note: Phase 1 UI is functional but not polished — basic Tailwind utilities only. Full visual styling comes in Phase 1.5. Correctness matters here, not aesthetics.

#### UI: Login Page (/login)
- [ ] Email and password form
- [ ] Inline validation — empty fields, wrong credentials
- [ ] On success — redirect to role-appropriate landing page
- [ ] On failure — error message displayed
- [ ] Offline detection banner

#### UI: Role-Based Routing
- [ ] Next.js middleware reads JWT, extracts role, redirects accordingly:
  - WAITER, CHEF, BARISTA -> /app/dashboard
  - KITCHEN_DISPLAY -> /app/kitchen
  - BARISTA_DISPLAY -> /app/barista
  - MANAGER -> /app/manage/dashboard
  - DIRECTOR -> /app/director
  - SYSTEM_ADMIN -> /app/admin
- [ ] Unauthenticated users -> /login
- [ ] Wrong-role route access -> redirect to own landing page

#### UI: Profile Page — All Roles (/app/profile)
- [ ] Display: name, email, phone, role, branch name
- [ ] Edit form: name, phone (email not editable)
- [ ] Change password section: current password, new password, confirm
- [ ] Save success — confirmation feedback
- [ ] Accessible from navigation for every role

#### UI: System Admin — Branch and User Management (/app/admin)
- [ ] List all branches — hub indicator, active status
- [ ] Create branch form — name, address, city, GPS coordinates
- [ ] Edit branch form
- [ ] Set hub branch (with confirmation)
- [ ] List all Director and Manager accounts
- [ ] Create Director / Manager account form
- [ ] Deactivate / reactivate account

#### UI: Manager — Staff Management (/app/manage/staff)
- [ ] List all staff at their branch — name, role, status
- [ ] Create staff account form (Waiter, Chef, Barista, Display accounts)
- [ ] Edit staff details
- [ ] Deactivate / reactivate (with confirmation)

#### Zustand: Auth Store
- [ ] useAuthStore — current user, role, organizationId, accessToken
- [ ] Auto-refresh access token before expiry
- [ ] Logout — clears store, calls logout endpoint

---

### Phase 1 Tests

**Integration Tests:**
- [ ] POST /auth/login — valid credentials; invalid returns 401
- [ ] POST /auth/refresh — valid cookie; missing cookie returns 401
- [ ] POST /auth/logout — clears cookie
- [ ] PATCH /auth/change-password — wrong current password returns 400
- [ ] POST /branches — SA creates; WAITER gets 403
- [ ] PATCH /branches/:id/set-hub — sets hub, removes previous hub
- [ ] POST /staff — manager creates for own branch; cannot create for another branch
- [ ] GET /staff — manager sees only own branch; DIR sees any branch
- [ ] PATCH /staff/:id/deactivate — deactivated user cannot log in

**Unit Tests:**
- [ ] JWT sign and verify utility
- [ ] Password hash and comparison utility

---

## 7. Phase 1.5 — Design System & Component Library

**Goal:** Every reusable UI component is built and visually verified against DESIGN_SYSTEM.md before any feature screen is assembled. This phase produces the building blocks. Every screen from Phase 2 onwards is composed exclusively from these components — no screen introduces its own base-level styles.

This is a frontend-only phase. No backend work. No new API endpoints.

After this phase: any screen can be built quickly and consistently. Phase 1 screens are also restyled using the new components.

---

### Setup

- [ ] Confirm Tailwind config from DESIGN_SYSTEM.md Section 13 is applied and all custom tokens work
- [ ] Apply global CSS: background-color Crema (#F5F0E8) on body, base text Stone 900 (#1C1917)
- [ ] Set global base font: DM Sans on body
- [ ] Confirm Google Fonts loading (Cormorant Garamond + DM Sans, all weights)
- [ ] Create components/ui/ folder — all base components live here
- [ ] Create /dev/components route (dev-only) — visual catalogue of every component for review

---

### Layout Components

- [ ] PageLayout — correct padding per breakpoint (16px mobile / 24px tablet / 32px desktop)
- [ ] PageHeader — page title (heading-xl DM Sans) + optional subtitle + optional action slot + Stone 200 border-bottom
- [ ] MobileLayout — mobile shell with bottom navigation slot and safe area handling
- [ ] SidebarLayout — desktop shell with 240px sidebar + scrollable main content
- [ ] FullscreenLayout — for KDS/BDS — no navigation, edge-to-edge

---

### Navigation Components

- [ ] BottomNav — mobile bottom navigation
  - Role-aware tabs passed as props
  - Active tab: Espresso icon and text + amber 2px top indicator line
  - Inactive: Stone 400
  - 64px height + safe area inset, 44px minimum tap target per tab
- [ ] SidebarNav — desktop sidebar
  - Logo at top, section labels (uppercase label-sm Stone 400)
  - NavItem: icon + label, hover and active states per Design System
  - Active: Stone 100 background, Espresso text and icon, 2px Espresso left border
- [ ] TopBar — KDS/BDS header
  - Branch name left, live clock centre, connection status right

---

### Foundation Components

- [ ] Button — Primary, Secondary, Ghost, Destructive variants
  - Sizes: lg (48px), md (44px), sm (36px)
  - States: default, hover, active, disabled, loading (spinner replaces label, same width)
- [ ] IconButton — icon-only, circular, same variants as Button
- [ ] Spinner — sizes: sm 16px, md 24px, lg 40px
- [ ] Badge — status chip, radius-full
  - Semantic variants: pending, inprogress, ready, closed, cancelled
  - Sizes: default and lg (for KDS)
- [ ] Divider — horizontal Stone 200 rule, optional centred label

---

### Form Components

- [ ] Input — text input
  - States: default, focus (Espresso border + amber focus ring), error, disabled
  - Optional: left icon, right icon, prefix text
  - Label above, helper/error text below
- [ ] Textarea — multi-line, same states as Input, vertical resize only
- [ ] Select — styled dropdown with custom chevron, hover and selected states per Design System
- [ ] Toggle — on/off switch. Off: Stone 300 track. On: Espresso track. White thumb. 200ms transition.
- [ ] FormField — wrapper composing label + input + helper/error text as one unit
- [ ] DatePicker — calendar popover on desktop, native date input on mobile
- [ ] TimePicker — HH:MM time input for shift management

---

### Card Components

- [ ] Card — base container: white, Stone 200 border, shadow-md, radius-md. Header / body / footer slots.
- [ ] StatCard — metric card
  - Cormorant Garamond display-lg for the value
  - DM Sans label-sm uppercase for the label
  - Optional icon top-right (Stone 400)
  - Optional caption subtext (Stone 500)
- [ ] OrderCard — waiter active order card
  - 3px left border coloured by order status
  - Order number prominent (heading-sm Espresso)
  - Type badge + TimeElapsed component
  - Status chip in footer
- [ ] KDSCard — kitchen/barista display card
  - 4px left border coloured by ticket status
  - Order number (heading-md Espresso)
  - Order type + table number (label-md Stone 700)
  - Items list (quantity bold weight 600, item name regular, body-md)
  - Special instructions (italic Stone 500, top-bordered Stone 200)
  - Timer with colour progression: Stone 500 -> Amber at 10 min -> Error Text at 20 min
  - Full-width action button at bottom (Claim or Mark Ready)
- [ ] MenuItemCard — waiter order-taking
  - Name, 2-line description clamp, price (label-lg Espresso weight 600)
  - Add button: 44px circle, Espresso, positioned bottom-right
  - Unavailable state: opacity 0.45, no add button, Unavailable badge
- [ ] StaffCard — staff member summary
  - Avatar initials circle + name, role badge, active status dot

---

### Overlay Components

- [ ] Modal — desktop
  - Warm dark overlay rgba(28,25,23, 0.5)
  - White background, radius-lg, shadow-xl, max-width 560px
  - Header + body + footer slots, close IconButton top-right
  - Enter: scale 0.96 to 1 and fade in 300ms ease-decelerate
  - Exit: scale to 0.96 and fade out 200ms ease-accelerate
- [ ] BottomSheet — mobile
  - Same overlay as Modal
  - Slides up from bottom 400ms ease-decelerate, radius-2xl top corners only
  - Drag handle (4px x 32px, Stone 300, centred, 12px from top)
  - Internal scroll when content overflows 90vh
- [ ] Popover — small floating panel. shadow-lg, radius-md, white. Auto-positions above/below trigger.
- [ ] ConfirmDialog — pre-built destructive action confirmation
  - Title + description + Cancel (Secondary) + Confirm (Destructive) buttons
  - Used for: deactivate staff, cancel order, delete zone, remove shift

---

### Feedback Components

- [ ] Toast — notification toast
  - Variants: success, error, warning, info — left border in semantic colour
  - Title + optional message body
  - Auto-dismiss: success/info 4s, warning 6s, error requires manual close
  - Enter: slide in from right on desktop, slide down from top on mobile
  - useToast() hook to trigger from anywhere in the app
- [ ] ToastContainer — renders active toasts. Top-right desktop / top-centre mobile. Max 3 stacked.
- [ ] EmptyState — icon (48px Stone 300) + heading (heading-sm Stone 700) + body (body-sm Stone 500 centred) + optional action button
- [ ] OfflineBanner — full-width, sticks to viewport top
  - WifiOff icon + "You're offline — check your connection"
  - Warning BG background, Warning Text colour

---

### Data Display Components

- [ ] Table — data table
  - Header: label-sm uppercase Stone 500, 2px Stone 200 bottom border
  - Rows: 52px height, 1px Stone 100 dividers, row hover -> Stone 100 background
  - No vertical borders
  - Sortable columns: chevron icon, amber tint when sorted
  - Empty state slot for zero-row states
- [ ] SkeletonBlock — shimmer placeholder. Accepts width, height, borderRadius as props.
- [ ] SkeletonCard — pre-composed card-shaped skeleton
- [ ] SkeletonTable — pre-composed table-shaped skeleton

---

### Utility Components

- [ ] Avatar — initials fallback. Sizes: sm 32px, md 40px, lg 48px. Espresso background, Crema text.
- [ ] ConnectionIndicator — dot showing WebSocket connection status. Green connected, amber reconnecting, red disconnected. Used in KDS/BDS TopBar.
- [ ] TimeElapsed — live-updating counter ("3 min", "14 min"). Accepts startTime timestamp, updates every 30s.
- [ ] PriceDisplay — formats KES amounts: "KES 1,200.00" in label-lg, Espresso, weight 600.

---

### Restyle Phase 1 Screens

Once the component library is complete, restyle all Phase 1 screens using the new components:
- [ ] Login page — full Design System treatment applied
- [ ] Profile page — components applied
- [ ] System Admin screens — components applied
- [ ] Manager staff management screen — components applied

---

### Phase 1.5 Verification

No API tests. Verification is visual — all components reviewed in the /dev/components catalogue:

- [ ] All components render correctly at 375px (mobile) and 1280px (desktop)
- [ ] All interactive states verified: hover, focus, active, disabled, loading, error
- [ ] All status badge variants render with correct colours from Design System
- [ ] Focus states use amber focus ring — keyboard navigation works throughout
- [ ] Toast system triggers, stacks (max 3), and auto-dismisses correctly
- [ ] Modal and BottomSheet animations match Design System spec
- [ ] OfflineBanner appears when navigator.onLine is false
- [ ] prefers-reduced-motion tested — all animations disable correctly
- [ ] KDSCard timer colour progression verified at 0, 10, and 20 minute marks

---

## 8. Phase 2 — Menu Management

**Goal:** The complete master menu exists in the system. Categories route to the correct prep station. Branch managers can toggle item availability. All screens are built with Design System components.

---

### Backend

#### Menu Endpoints
- [ ] GET /api/v1/menu
- [ ] GET /api/v1/menu/categories
- [ ] POST /api/v1/menu/categories
- [ ] PATCH /api/v1/menu/categories/:id
- [ ] DELETE /api/v1/menu/categories/:id
- [ ] POST /api/v1/menu/items
- [ ] PATCH /api/v1/menu/items/:id
- [ ] DELETE /api/v1/menu/items/:id
- [ ] PATCH /api/v1/menu/items/:id/availability

#### Redis Menu Cache
- [ ] Cache GET /menu per branch, TTL 1 hour
- [ ] Invalidate on availability toggle
- [ ] Invalidate on item name or price update

---

### Frontend

#### UI: System Admin / Director — Menu Management (/app/admin/menu)
- [ ] Category list — name, KITCHEN/BARISTA badge, item count, active status (Table component)
- [ ] Create category — Modal: name, prep station selector, display order input
- [ ] Edit category — same Modal pre-filled
- [ ] Delete category — ConfirmDialog; blocked with error Toast if active items exist
- [ ] Item list within each category — name, price, active status
- [ ] Create item — Modal: name, description, price
- [ ] Edit item — same Modal pre-filled
- [ ] Delete item — ConfirmDialog

#### UI: Manager — Menu Availability (/app/manage/menu)
- [ ] Read-only menu grouped by category using MenuItemCard layout
- [ ] Toggle per item — available / unavailable
- [ ] Unavailable items: opacity 0.45, Unavailable badge
- [ ] Optimistic UI — toggle responds instantly, reverts with error Toast on API failure

---

### Phase 2 Tests

**Integration Tests:**
- [ ] POST /menu/categories — SA creates; WAITER gets 403
- [ ] DELETE /menu/categories/:id — fails 409 if category has active items
- [ ] GET /menu — returns only available items for requesting branch
- [ ] PATCH /menu/items/:id/availability — manager toggles own branch; cannot toggle another
- [ ] GET /menu (second call) — served from Redis cache
- [ ] PATCH /menu/items/:id/availability — invalidates Redis cache for the branch

**Unit Tests:**
- [ ] Menu availability merge — master menu + branch overrides = correct per-item availability

---

## 9. Phase 3 — Order Management

**Goal:** The complete order lifecycle works end-to-end. A waiter creates an order. It appears on KDS/BDS in real time. A chef and/or barista claims and marks it ready. The waiter records payment. Order closes. Every operational role has a Dashboard, a display interface, and an Order History page.

This is the most complex phase. It delivers the primary value of the platform.

---

### Backend

#### Order Endpoints
- [ ] POST /api/v1/orders
- [ ] GET /api/v1/orders
- [ ] GET /api/v1/orders/active
- [ ] GET /api/v1/orders/:id
- [ ] PATCH /api/v1/orders/:id/items
- [ ] PATCH /api/v1/orders/:id/payment
- [ ] PATCH /api/v1/orders/:id/cancel

#### Prep Ticket Endpoints
- [ ] GET /api/v1/prep-tickets
- [ ] PATCH /api/v1/prep-tickets/:id/claim
- [ ] PATCH /api/v1/prep-tickets/:id/ready

#### Order Business Logic
- [ ] Menu item availability validation before order creation
- [ ] Price snapshotting — copy MenuItem.price to OrderItem.unitPrice at creation
- [ ] Subtotal, delivery fee, total calculation
- [ ] Daily order number generation inside DB transaction (no duplicates)
- [ ] PrepTicket routing — one ticket per prep station involved
- [ ] Order status derivation from ticket statuses
- [ ] Order modification — delete/recreate affected items, regenerate PrepTicket JSON snapshot

#### WebSocket Layer
- [ ] order:new -> correct station room after order creation
- [ ] order:claimed -> waiter user room after claim
- [ ] order:ready -> waiter user room after ticket marked ready
- [ ] order:all_ready -> waiter user room when all tickets ready
- [ ] order:modified -> affected station room after modification
- [ ] order:cancelled -> station rooms after cancellation
- [ ] Reconnection sync — GET /orders/active called on WebSocket reconnect

#### Push Notifications (FCM)
- [ ] FCM push to waiter when their order is ready (app backgrounded or device locked)

---

### Frontend

#### UI: Waiter — Dashboard (/app/dashboard for WAITER)
- [ ] Greeting — Cormorant Garamond display-lg: "Good morning, [Name]"
- [ ] StatCards: orders taken today, total value today
- [ ] Active orders summary — count of Pending / In-Progress / Ready
- [ ] Primary Button "New Order" -> /app/orders/new
- [ ] Last 5 orders — OrderCard format, tappable -> Order Detail BottomSheet

#### UI: Waiter — Create Order (/app/orders/new)
- [ ] Full menu in MenuItemCard grid grouped by category
- [ ] Category filter tabs at top (horizontal scroll)
- [ ] Cart icon in header with item count Badge
- [ ] Add item -> cart icon nudge animation (ease-spring per Design System)
- [ ] Cart BottomSheet — items list, quantity increment/decrement, subtotals, total, remove per item
- [ ] Order type selector — Dine-In, Take-Away (Delivery added in Phase 4)
- [ ] Table number Input (Dine-In only)
- [ ] Order notes Textarea
- [ ] Submit Button — disabled when cart empty or required fields missing
- [ ] Confirmation BottomSheet before final submit — order summary
- [ ] Success -> Toast "Order #X sent to the kitchen", cart clears

#### UI: Waiter — Active Orders (/app/orders)
- [ ] Live list of all active orders, OrderCard per order
- [ ] Real-time status updates via WebSocket — no page refresh
- [ ] In-app notification banner when any order is ready
- [ ] Tap OrderCard -> Order Detail BottomSheet:
  - Full item list, prices, total
  - Per-station prep status with claimedBy name
  - Edit Button (visible while any station still Pending)
  - Record Payment Button (visible when all stations Ready)
  - Payment method Select (Mpesa, Cash, Card)
  - Confirm Payment -> order closes, success Toast

#### UI: Waiter — Order History (/app/history for WAITER)
- [ ] Paginated list of all past orders created by this waiter
- [ ] Filter: date range DatePicker, status (Closed / Cancelled)
- [ ] Each row: order number, date, type, item count, total, status Badge
- [ ] Tap row -> Order Detail Modal (read-only)
- [ ] Summary at top: total orders and total value for filtered period

---

#### UI: KDS — Kitchen Display (/app/kitchen — tablet, KITCHEN_DISPLAY role)
- [ ] FullscreenLayout — no navigation, edge-to-edge
- [ ] TopBar — branch name, live clock, ConnectionIndicator
- [ ] Three-column queue: Pending | In-Progress | Ready
- [ ] KDSCard per ticket in each column
- [ ] New card slides into Pending — slide-in-top animation + audio notification
- [ ] Claim Button -> Select dropdown of chefs currently on shift -> card moves to In-Progress
- [ ] Mark Ready Button -> card moves to Ready, waiter notified
- [ ] Ready column cards cleared when parent order closes
- [ ] OfflineBanner when WebSocket disconnects

#### UI: Chef — Dashboard (/app/dashboard for CHEF)
- [ ] Greeting — Cormorant Garamond display-lg: "Good morning, [Name]"
- [ ] StatCards: tickets completed today, average prep time today
- [ ] My Active Orders — KDSCard format for In-Progress tickets claimed by this chef
- [ ] Quick link Button to Kitchen Display

#### UI: Chef — Personal Kitchen View (/app/kitchen on mobile, CHEF role)
- [ ] Single-column responsive layout
- [ ] Pending section — unclaimed tickets, Claim Button with staff Select dropdown
- [ ] My Orders section — tickets claimed by this chef, Mark Ready Button per ticket
- [ ] Audio and push notifications for new orders
- [ ] Real-time updates via WebSocket

#### UI: Chef — Order History (/app/history for CHEF)
- [ ] Paginated list of all prep tickets claimed by this chef
- [ ] Filter: date range
- [ ] Each row: order number, date, item count, prep time duration, status Badge
- [ ] Tap row -> ticket detail Modal (read-only): items, claim time, ready time, duration

---

#### UI: Barista — Dashboard (/app/dashboard for BARISTA)
- [ ] Identical structure to Chef Dashboard

#### UI: BDS — Barista Display (/app/barista — tablet, BARISTA_DISPLAY role)
- [ ] Identical layout and behaviour to KDS
- [ ] Claim dropdown shows baristas currently on shift

#### UI: Barista — Personal Barista View (/app/barista on mobile, BARISTA role)
- [ ] Identical structure to Chef personal kitchen view

#### UI: Barista — Order History (/app/history for BARISTA)
- [ ] Identical structure to Chef order history

---

#### Zustand Stores
- [ ] useOrderStore — active orders, cart state, real-time WebSocket updates
- [ ] useKitchenStore — prep tickets per station, real-time claim and status updates

---

### Phase 3 Tests

**Integration Tests:**
- [ ] POST /orders (Dine-In) — creates order, items, and correct prep tickets in one transaction
- [ ] POST /orders (Take-Away) — no table number required
- [ ] POST /orders — fails 400 if menu item unavailable at branch
- [ ] POST /orders — fails 400 if items array is empty
- [ ] POST /orders — order numbers sequential and reset daily per branch
- [ ] PATCH /orders/:id/items — updates total and PrepTicket JSON snapshot
- [ ] PATCH /orders/:id/items — fails 409 if all prep tickets are In-Progress
- [ ] PATCH /prep-tickets/:id/claim — moves to In-Progress; second claim returns 409
- [ ] PATCH /prep-tickets/:id/ready — if all tickets ready, Order status becomes READY
- [ ] PATCH /orders/:id/payment — fails if order status is not READY
- [ ] PATCH /orders/:id/cancel — fails 409 if any ticket is In-Progress or Ready
- [ ] WebSocket — order:new emitted to correct station room
- [ ] WebSocket — order:claimed emitted to waiter user room
- [ ] WebSocket — order:all_ready emitted when last ticket marked ready

**Unit Tests:**
- [ ] Price snapshotting — OrderItem.unitPrice equals MenuItem.price at order time
- [ ] Total calculation — subtotal = sum(quantity x unitPrice); total = subtotal + deliveryFee
- [ ] PrepTicket routing — KITCHEN category -> KITCHEN ticket; BARISTA -> BARISTA ticket
- [ ] Order status derivation — PENDING when none claimed; IN_PROGRESS when any claimed; READY when all ready
- [ ] Daily order number — sequential, no gaps, resets on new date per branch

---

## 10. Phase 3.5 — Navigation, Shell Polish & FCM Web Push

**Goal:** Every role has a fully wired, cohesive authenticated experience. Navigation is connected. Logout works from every screen. Layout shells wrap every page. The system feels like a single premium product — not a collection of disconnected screens. FCM web push is fully wired for background push notifications to waiters.

This is a frontend-only phase with one backend task (FCM token registration). No new business features. No new API endpoints beyond what already exists.

After this phase: a waiter, chef, manager, or director can log in and move through their entire interface without friction. The system is demonstrable to stakeholders end-to-end.

---

### Navigation Wiring — All Roles

- [ ] Wire `BottomNav` for WAITER with tabs: Dashboard (`LayoutDashboard`), New Order (`ShoppingCart`), Orders (`ClipboardList`), History (`Clock`), Profile (`UserCircle`) — correct routes, active state from `usePathname()`
- [ ] Wire `BottomNav` for CHEF with tabs: Dashboard (`LayoutDashboard`), Kitchen (`ChefHat`), History (`Clock`), Profile (`UserCircle`)
- [ ] Wire `BottomNav` for BARISTA with tabs: Dashboard (`LayoutDashboard`), Barista (`Coffee`), History (`Clock`), Profile (`UserCircle`)
- [ ] Wire `SidebarNav` for MANAGER with sections and items:
  - Operations: Dashboard (`LayoutDashboard`), Orders (`ShoppingCart`)
  - Manage: Staff (`Users`), Menu (`UtensilsCrossed`), Shifts (`Calendar`), Delivery Zones (`Bike`)
  - Reports (`BarChart2`)
  - Account: Profile (`UserCircle`), Logout
- [ ] Wire `SidebarNav` for DIRECTOR with sections and items:
  - Overview: Dashboard (`LayoutDashboard`)
  - Reports (`BarChart2`)
  - Account: Profile (`UserCircle`), Logout
- [ ] Wire `SidebarNav` for SYSTEM_ADMIN with sections and items:
  - Admin: Branches & Users (`Settings2`), Menu (`UtensilsCrossed`)
  - Account: Profile (`UserCircle`), Logout
- [ ] Active nav item derived from `usePathname()` — exact match for leaf routes, prefix match for nested routes (e.g. `/app/orders/new` activates the Orders tab)

---

### Logout

- [ ] Logout action calls `POST /auth/logout`, clears `useAuthStore`, clears socket connection, redirects to `/login`
- [ ] Logout is accessible from the sidebar bottom (Manager/Director/Admin) and from the Profile page (all mobile roles)
- [ ] Logout triggers a `ConfirmDialog` — "Are you sure you want to log out?" — before executing
- [ ] On logout, any active socket listeners are removed and the socket is disconnected

---

### Layout Shell Wiring — Every Page

- [ ] Wrap all WAITER, CHEF, BARISTA pages in `MobileLayout` with the correct role-specific `BottomNav`
- [ ] Wrap all MANAGER, DIRECTOR pages in `SidebarLayout` with the correct role-specific `SidebarNav`
- [ ] Wrap SYSTEM_ADMIN pages in `SidebarLayout`
- [ ] KDS (`/app/kitchen`) and BDS (`/app/barista`) remain in `FullscreenLayout` — no nav
- [ ] Confirm `OfflineBanner` appears above all layout shells (not inside them) — sticks to viewport top regardless of scroll position
- [ ] Confirm `ToastContainer` is rendered once at the root layout level — not per-page

---

### FCM Web Push — Full Implementation

- [ ] Install `firebase` client SDK in `frontend/` with `pnpm add firebase`
- [ ] Add to `frontend/.env.local`: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- [ ] Create `frontend/lib/firebase.ts` — initializes Firebase app (singleton pattern with `getApps()` guard), exports `getFirebaseMessaging()` async function that checks `isSupported()` before returning the messaging instance
- [ ] Create `frontend/public/firebase-messaging-sw.js` — service worker using compat SDK (`importScripts` from CDN), initializes Firebase with the public config, registers `onBackgroundMessage` handler that calls `self.registration.showNotification` with title, body, and `data: { orderId }` payload; clicking the notification navigates to `/app/orders`
- [ ] Create `frontend/hooks/useFcmToken.ts` — on mount (WAITER, CHEF, BARISTA roles only): requests `Notification.requestPermission()`, if granted calls `getToken(messaging, { vapidKey })`, checks `localStorage` for existing token to avoid re-registration, if token is new or changed calls `POST /auth/register-device` with the token; all failures are caught and logged silently — never shown to the user
- [ ] Call `useFcmToken()` inside the authenticated root layout — runs once per session after login
- [ ] Update `backend/src/services/fcm-service.ts` — change from stub to full implementation: looks up `fcmToken` via `authRepository.findFcmToken`, sends via `firebaseMessaging.send` with `webpush` config including `VAPID_KEY` from env, `notification` title/body, `fcmOptions.link: '/app/orders'`; catches all errors silently
- [ ] Add `VAPID_KEY` to `backend/src/config/env.ts` Zod schema (string, optional — graceful no-op when absent)

---

### Design System Polish — Premium Quality Pass

The following checks must be applied to every screen built in Phases 1 through 3. Reference `DESIGN_SYSTEM.md` for exact values.

#### Colour & Background
- [ ] Confirm body background is `bg-crema` (`#F5F0E8`) on every page — never plain white
- [ ] Confirm no pure `#FFFFFF` backgrounds on page-level containers (cards may use white — that is correct)
- [ ] Confirm no pure `#000000` or `#111111` text anywhere — all text uses Stone palette
- [ ] Confirm Espresso (`#2C1810`) is used only on primary buttons, active nav states, and key interactive elements — not as decorative colour or large area fill
- [ ] Confirm Amber (`#C4862A`) appears at most twice per screen — never as a dominant colour

#### Typography
- [ ] Confirm Cormorant Garamond (`font-display`) is used only for display text and top-level page greetings — not on buttons, labels, nav items, or body copy
- [ ] Confirm DM Sans (`font-sans`) is used for all operational text — buttons, labels, nav, forms, tables, body
- [ ] Confirm every page has exactly one `text-heading-xl` element — no page has two; no page skips directly from display to heading-sm
- [ ] Confirm no font weight below 400 is used in any UI context

#### Spacing & Layout
- [ ] Confirm mobile pages have `px-4` (16px) horizontal padding on content
- [ ] Confirm desktop pages have `px-8` (32px) horizontal padding on content
- [ ] Confirm main content area has `max-w-[1280px] mx-auto` on desktop
- [ ] Confirm all form fields have label above input — no floating labels, no placeholder-only fields

#### Shadows & Elevation
- [ ] Confirm shadows use only the warm Espresso-tinted shadow tokens (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`) — no Tailwind default shadows
- [ ] Confirm cards inside modals have no shadow (shadows do not stack)
- [ ] Confirm hover states on interactive cards increase elevation by one level (`shadow-sm` → `shadow-md`, `shadow-md` → `shadow-lg`)

#### Focus & Accessibility
- [ ] Confirm all interactive elements have a visible focus ring using the Amber focus ring (`shadow-focus`, `0 0 0 3px rgba(196, 134, 42, 0.35)`) — never blue
- [ ] Confirm all touch targets are minimum 44px × 44px on mobile
- [ ] Confirm `prefers-reduced-motion` media query disables all animations and transitions globally (already in `globals.css` from Phase 1.5 — verify it is present)

#### Components
- [ ] Confirm all `Button` components use `radius-md` (8px) — no fully rounded primary buttons
- [ ] Confirm all status badges use `radius-full` pill shape
- [ ] Confirm all modals use `radius-lg` (12px) on desktop; `radius-xl` (16px) on mobile
- [ ] Confirm all input fields use `radius-sm` (4px) and `bg-parchment` background
- [ ] Confirm `EmptyState` components use Wendo voice copy (e.g. "No orders yet today" not "No records found") — reference DESIGN_SYSTEM.md Section 2 brand voice table
- [ ] Confirm loading states use `SkeletonBlock`/`SkeletonCard` for content areas — not a full-page spinner

#### Page Structure
- [ ] Confirm every page uses `PageHeader` component with `text-heading-xl` title and optional subtitle in `text-body-sm text-stone-500`
- [ ] Confirm `PageHeader` has `border-b border-stone-200 mb-6` separator below it
- [ ] Confirm page transitions use `animate-fade-up` on the main content container — consistent across all route changes

---

### Phase 3.5 Verification

- [ ] Log in as each role (WAITER, CHEF, BARISTA, MANAGER, DIRECTOR, SYSTEM_ADMIN) and navigate every tab/link — no broken routes, no missing active states
- [ ] Logout from sidebar (desktop) and from Profile page (mobile) — both work, both show confirm dialog
- [ ] Lock the phone while a WAITER has an active order in-progress — when the chef marks ready, a push notification appears on the lock screen
- [ ] Tap the push notification — Chrome opens to `/app/orders`
- [ ] Disconnect WiFi — `OfflineBanner` appears on all pages; reconnect — banner disappears
- [ ] Open the app on a 375px mobile viewport and a 1280px desktop viewport — confirm layouts are correct for both
- [ ] Check every page for Espresso-tinted shadows — open DevTools and confirm no default Tailwind shadow is in use
- [ ] Tab through an entire form with keyboard only — amber focus ring visible on every interactive element

---

## 11. Phase 4 — Delivery Zones

**Goal:** Branch managers configure delivery zones and fees. The full delivery order flow works end-to-end — zone selection, automatic fee calculation, pre-payment confirmation before prep, and handoff to Grubba.

---

### Backend

#### Delivery Zone Endpoints
- [ ] GET /api/v1/delivery-zones
- [ ] POST /api/v1/delivery-zones
- [ ] PATCH /api/v1/delivery-zones/:id
- [ ] DELETE /api/v1/delivery-zones/:id

#### Delivery Order Flow
- [ ] deliveryZoneId validation on POST /orders (type: DELIVERY)
- [ ] Delivery fee from zone added to order total
- [ ] Payment confirmation gate — prep not started until payment confirmed by waiter
- [ ] PATCH /orders/:id/payment for delivery — Mpesa only, marks Handed to Grubba on close

---

### Frontend

#### UI: Manager — Delivery Zone Management (/app/manage/delivery-zones)
- [ ] List of zones — name, fee (KES), active status — Table component
- [ ] Create zone — Modal: zone name, fee Input
- [ ] Edit zone — same Modal pre-filled
- [ ] Deactivate zone — ConfirmDialog

#### UI: Waiter — Delivery Order Flow (additions to Phase 3 create order)
- [ ] Delivery option added to order type selector
- [ ] Delivery zone Select dropdown — appears when Delivery selected
- [ ] Zone selection immediately updates delivery fee and order total in cart
- [ ] Payment confirmation BottomSheet before submit: "Confirm customer has paid KES X via Mpesa"
- [ ] Submit Button labelled "Confirm Payment and Submit" for delivery orders
- [ ] Order Detail shows "Hand to Grubba" Button after all prep is Ready
- [ ] Confirm handoff -> order closes, success Toast

---

### Phase 4 Tests

**Integration Tests:**
- [ ] POST /delivery-zones — manager creates for own branch; cannot create for another
- [ ] GET /delivery-zones — only active zones for the requesting branch
- [ ] POST /orders (Delivery) — total = subtotal + zone fee
- [ ] POST /orders (Delivery) — fails 400 if deliveryZoneId missing
- [ ] POST /orders (Delivery) — fails 400 if deliveryZoneId belongs to another branch
- [ ] PATCH /orders/:id/payment (Delivery) — CASH returns 400; MPESA succeeds

**Unit Tests:**
- [ ] Delivery total — correctly includes delivery zone fee

---

## 11. Phase 5 — Staff Management

**Goal:** Managers create and manage shift schedules. Staff clock in and out with server-side geofencing enforced. Every staff member has a Shifts page showing their personal schedule and attendance history.

---

### Backend

#### Shift Endpoints
- [x] GET /api/v1/shifts
- [x] POST /api/v1/shifts
- [x] PATCH /api/v1/shifts/:id

#### Shift Assignment Endpoints
- [x] GET /api/v1/shift-assignments
- [x] POST /api/v1/shift-assignments
- [x] POST /api/v1/shift-assignments/reconcile-week
- [x] POST /api/v1/shift-assignments/batch-delete
- [x] DELETE /api/v1/shift-assignments/:id

#### Clock Record Endpoints
- [ ] POST /api/v1/clock/in
- [ ] POST /api/v1/clock/out
- [ ] POST /api/v1/clock/override

#### Geofencing Logic
- [ ] Haversine distance calculation utility
- [ ] Server-side geofence check against branch coordinates
- [ ] Return distance in metres in 403 error response

#### BullMQ: Shift Reminder Job
- [ ] Nightly scheduler (9pm) — queries all tomorrow's shift assignments across branches
- [ ] Queues one FCM push notification per staff member with a shift tomorrow
- [ ] Notification text: "You have a [Shift Name] shift tomorrow at [startTime]"

---

### Frontend

#### UI: Manager — Shift Management (/app/manage/shifts)

**Shift Definitions**
- [ ] List: name, start time, end time — Table component
- [ ] Create shift — Modal: name, start TimePicker, end TimePicker
- [ ] Edit shift — same Modal pre-filled
- [ ] Delete shift (blocked if future assignments exist — error Toast)

**Shift Schedule**
- [ ] Weekly calendar view — all staff assignments for the week
- [ ] Each cell: staff name + role Badge
- [ ] Assign: date, shift Select, staff Select -> POST to API
- [ ] Remove assignment — ConfirmDialog
- [ ] Previous and next week navigation

**Attendance View**
- [ ] Daily view — all staff assigned today, shift, clock-in/out time, method
- [ ] GPS vs Override — icon indicator
- [ ] Override reason shown in Popover on tap/hover

**Shift Sheet Redesign Addendum**
- [x] Shift Definitions tab retains branch-scoped CRUD backed by live DB shift records
- [x] Spreadsheet-style weekly roster view - staff rows, Sunday-Saturday columns, hours total
- [x] Staff rows grouped by role (`CHEF`, `WAITER`, `BARISTA`) and alphabetized within groups
- [x] Assign or clear directly in roster cells using live shift definitions and `OFF`
- [x] Autosave roster edits through `POST /api/v1/shift-assignments/reconcile-week`
- [x] Shift-click / Shift-drag multi-cell selection with temporary "Clear shifts" action
- [x] Previous and next week navigation
- [x] Expand sheet focus mode
- [x] Today's Attendance tab remains available; manager override actions require manager branch scope

#### UI: HR - Shift Management (/app/hr/shifts)
- [x] HR Manager can open the same spreadsheet roster under the HR account
- [x] Branch selector scopes staff, shifts, schedule assignments, copy-week, and save/reconcile operations
- [x] Shift Definitions tab supports branch-scoped CRUD for the selected branch
- [x] Today's Attendance tab is visible cross-branch; attendance override remains manager-only

#### UI: Staff — Shifts Page (/app/shifts — WAITER, CHEF, BARISTA)
- [ ] Upcoming 7 days — Card per day: shift name, date, start/end time
- [ ] Today's shift highlighted with Clock In/Out state shown inline
- [ ] Past 30 days — list with actual clock-in/out times and method (GPS / Override)
- [ ] EmptyState if no upcoming shifts: "No upcoming shifts scheduled"

#### UI: Staff — Clock In/Out (integrated into Dashboard and Shifts page)
- [ ] Today's shift card on Dashboard with clock-in status
- [ ] Clock In Button — triggers browser GPS request, sends coordinates to server
  - Success: shows clocked-in time, button becomes Clock Out
  - Geofence error Toast: "You're Xm from the branch. Move closer to clock in."
  - GPS unavailable Toast: "Location unavailable — ask your manager to clock you in"
- [ ] Clock Out Button — same GPS flow
- [ ] No shift today: EmptyState on clock widget

---

### Phase 5 Tests

**Integration Tests:**
- [ ] POST /shifts — manager creates for own branch; cannot create for another
- [ ] POST /shift-assignments — duplicate assignment returns 409
- [ ] GET /shift-assignments — staff sees only own; manager sees all for branch
- [ ] POST /clock/in — within 50m succeeds with method GPS
- [ ] POST /clock/in — outside 50m returns 403 with distance in metres
- [ ] POST /clock/in — clocking in twice without clocking out returns 409
- [ ] POST /clock/override — creates record with OVERRIDE method and reason note
- [ ] DELETE /shift-assignments/:id — cannot delete past or today's assignments

**Unit Tests:**
- [ ] Haversine — known coordinate pairs return correct distances
- [ ] Haversine edge case — same point returns 0

---

## 12. Phase 6 — Reporting & Dashboards

**Goal:** Managers have a live operations dashboard and historical reports. Directors have a cross-branch overview. Every operational staff member has a personal Performance page showing their own metrics.

After this phase: the system is feature-complete for V1.

---

### Backend

#### Report Endpoints
- [ ] GET /api/v1/reports/daily-summary
- [ ] GET /api/v1/reports/staff-performance
- [ ] GET /api/v1/reports/branch-overview (DIR only)
- [ ] GET /api/v1/reports/export (PDF + CSV)

#### Personal Performance Endpoint
- [ ] GET /api/v1/reports/my-performance — authenticated user's own metrics only
  - WAITER: orders handled, average order value, total revenue generated, busiest day
  - CHEF: tickets completed, average prep time, fastest prep time, busiest day
  - BARISTA: same metrics as Chef

#### BullMQ: Nightly Report Pre-computation
- [ ] Nightly job (11pm) — computes and caches daily summary per branch
- [ ] Today's summary served from cache; past dates computed on demand
- [ ] Cache key: report:daily:{organizationId}:{date}

#### Report Logic
- [ ] Daily revenue aggregation (closed orders only, excludes cancelled)
- [ ] Revenue by payment method breakdown
- [ ] Top 5 items by quantity sold
- [ ] Average prep time per station — mean of (readyAt minus claimedAt)
- [ ] Staff performance — orders, prep times, scheduled vs actual hours
- [ ] Personal performance — scoped to authenticated user only
- [ ] Cross-branch aggregation for Director

#### PDF and CSV Export
- [ ] PDF generation using Node.js PDF library
- [ ] CSV — structured, importable format
- [ ] File download with correct Content-Disposition header

---

### Frontend

#### UI: Waiter — Performance Page (/app/performance for WAITER)
- [ ] Date range selector — this week / this month / custom DatePicker
- [ ] StatCards: total orders taken, average order value, total revenue generated, busiest day
- [ ] Orders over time — bar chart by day for selected range
- [ ] Top 5 items ordered — list by frequency

#### UI: Chef — Performance Page (/app/performance for CHEF)
- [ ] Date range selector
- [ ] StatCards: tickets completed, average prep time, fastest prep, busiest day
- [ ] Prep time trend — bar chart (daily average over selected range)

#### UI: Barista — Performance Page (/app/performance for BARISTA)
- [ ] Identical structure to Chef Performance page

---

#### UI: Manager — Dashboard (/app/manage/dashboard)

**Live Operations Panel**
- [ ] Active orders feed — OrderCard per order, real-time WebSocket updates
- [ ] Staff on shift today — name, role, clock-in status (clocked in / not yet / override)
- [ ] StatCards at top: orders today, revenue today, avg prep time today

**Daily Summary Panel**
- [ ] Total revenue for today
- [ ] Order count by type — bar chart (Dine-In / Take-Away / Delivery)
- [ ] Top 5 selling items — name and quantity
- [ ] Revenue by payment method breakdown
- [ ] DatePicker — view any past date

**Reports Section (/app/manage/reports)**
- [ ] Staff performance report — date range DatePicker, Table of results
- [ ] Export Button — dropdown: PDF / CSV

---

#### UI: Director — Dashboard (/app/director)

**Overview Panel**
- [ ] StatCards: total revenue today (all branches), total orders today
- [ ] Branch selector — single branch or aggregated view
- [ ] Order volume per branch — comparison bar chart
- [ ] Avg prep time per branch — Kitchen and Barista

**Branch Performance Report**
- [ ] Date range DatePicker
- [ ] Per-branch Table: revenue, order count, avg prep time
- [ ] Export as PDF or CSV

**Staff Performance Report**
- [ ] Cross-branch staff Table — filter by branch Select and role Select
- [ ] Export as PDF or CSV

---

### Phase 6 Tests

**Integration Tests:**
- [ ] GET /reports/daily-summary — correct totals for a date with known order data
- [ ] GET /reports/daily-summary — manager cannot access another branch; DIR can access any
- [ ] GET /reports/my-performance — user sees own stats; cannot access another user's stats
- [ ] GET /reports/staff-performance — correct order counts and prep times
- [ ] GET /reports/branch-overview — MANAGER gets 403; DIR succeeds
- [ ] GET /reports/export?format=csv — returns a valid CSV file
- [ ] GET /reports/export?format=pdf — returns a valid PDF file

**Unit Tests:**
- [ ] Revenue aggregation — sums closed orders, excludes cancelled
- [ ] Average prep time — correct mean from ticket timestamps
- [ ] Actual hours — correct decimal hours from clockInAt and clockOutAt difference

---

## 13. Phase 7 — Credit Accounts

**Goal:** The system tracks staff benefits (House Accounts), corporate client billing (Corporate Accounts), and customer credit lines (Customer Credit Accounts). The Director can view outstanding balances across all account types. The Accountant role gains access to settlement and reconciliation.

**Status: ✅ Complete**

---

### Backend

#### New Models (DB Migrations Required)
- [x] `HouseAccount` — 1:1 with User; `creditLimit`, `currentBalance`, `requiresAuthorization`
- [x] `HouseAccountSettlement` — balance repayment records
- [x] `HouseAccountAuthRequest` — approval request when `requiresAuthorization = true`
- [x] `CorporateAccount` — system-level (no `organizationId`); `companyName`, `creditLimit`, `currentBalance`
- [x] `CorporateAccountSettlement`
- [x] `CustomerCreditAccount` — branch-scoped; `customerName`, `customerPhone`, `creditLimit`
- [x] `CustomerCreditSettlement`
- [x] Extended `PaymentMethod` enum: added `HOUSE_ACCOUNT`, `CORPORATE_ACCOUNT`, `CUSTOMER_CREDIT`
- [x] Extended `Order` model: added FK fields for all three credit account types + `corporateEmployeeRef`
- [x] New `OrderStatus` value: `AWAITING_AUTHORIZATION`

#### New Routes
- [x] `GET/POST/PATCH /house-accounts` — Director/SA manage accounts
- [x] `GET /house-accounts/my` — staff view own account
- [x] `POST /house-accounts/:id/settle` — Manager/Accountant record settlement
- [x] `GET /house-account-auth` — list pending auth requests
- [x] `POST /house-account-auth/:id/override` — approve or reject
- [x] `POST /house-account-auth/:id/force-expire` — escape hatch
- [x] `GET/POST/PATCH /corporate-accounts` — Director/SA
- [x] `POST /corporate-accounts/:id/settle`
- [x] `GET/POST/PATCH /customer-credit` — Manager/SA
- [x] `POST /customer-credit/:id/settle`
- [x] `GET /reports/outstanding-balances` — Director/Accountant

#### Business Rules
- [x] Credit limit checked inside `$transaction` to prevent race conditions
- [x] `HOUSE_ACCOUNT` orders excluded from all revenue totals (accounts receivable, not collected revenue)
- [x] `requiresAuthorization = true` → order transitions to `AWAITING_AUTHORIZATION` → manager/director notified via FCM + Socket.io
- [x] On approval: `recordPayment` WHERE clause accepts `{ in: [READY, AWAITING_AUTHORIZATION] }` (do not revert to `READY` only)

#### New Role: ACCOUNTANT
- [x] Cross-branch read access to all credit accounts and reports
- [x] Settlement write access (House, Corporate, Customer Credit)
- [x] Access to branch overview, director trends, and reconciliation reports
- [x] No access to branch operations (orders, staff management, shifts)

---

### Frontend
- [x] `/app/house-account/my` — staff view their own account and settlement history
- [x] `/app/house-account/authorize` — manager/director approve/reject pending House Account payments (dashboard widget)
- [x] `/app/manage/house-accounts` — Manager: manage branch staff House Accounts
- [x] `/app/director/accounts` — Director: view all account types and outstanding balances
- [x] `/app/accountant` — Accountant dashboard with revenue, collections, and outstanding balance KPIs
- [x] `/app/accountant/analytics` — full analytics with branch breakdown and payment method breakdown
- [x] Corporate and Customer Credit management pages for Director/Manager

### Phase 7 Tests
- [x] House Account payment creates auth request when `requiresAuthorization = true`
- [x] Approval closes order and increments `currentBalance` atomically
- [x] Rejection returns order to `READY`, logs `PAYMENT_REJECTED` incident
- [x] Credit limit check inside transaction — concurrent requests cannot exceed limit
- [x] `HOUSE_ACCOUNT` orders excluded from `totalRevenue` in daily summary
- [x] Outstanding balances report aggregates all three account types correctly

---

## 14. Phase 8 — Operations Expansion

**Goal:** The system gains Other Income recording, the HR Module (employee profiles, leave management, disciplinary records), Internal Communications (DMs, broadcasts, formal notices), staff and customer discount flows, and Director-level incident log access. The system also gains the Accountant reconciliation report.

**Status: ✅ Complete**

This phase was built in parallel sub-tracks that did not depend on each other (except all depending on Phase 7's schema foundation).

---

### Sub-track A: Other Income

- [x] `OtherIncomeCategory` model — Director-defined, optionally branch-scoped
- [x] `OtherIncomeEntry` model — recorded per transaction, supports split payments
- [x] `OtherIncomePaymentMethod` enum: `CASH`, `MPESA`, `CARD`, `SPLIT`
- [x] Routes: `GET/POST/PATCH /other-income/categories`, `GET/POST /other-income/entries`, `DELETE /other-income/entries/:id`
- [x] Other income totals included in `BranchOverviewRow.revenue` and director trend sparklines
- [x] Frontend: `/app/other-income/new` (Waiter/Manager record income), `/app/other-income/history`, `/app/director/other-income` (Director manage categories)
- [x] Client-side receipt printing for other income entries (`window.open` pattern)

---

### Sub-track B: Discounts (Staff + Customer)

- [x] `Discount` model — named customer discounts (PERCENTAGE or FIXED_AMOUNT), optionally branch-scoped
- [x] `StaffDiscountAuthRequest` model — 20% staff discount requires manager approval
- [x] `CustomerDiscountAuthRequest` model — approval-required named discounts
- [x] Extended `Order`: `discountPercent`, `discountAmount`, `discountedById`, `discountId`
- [x] `AWAITING_AUTHORIZATION` disambiguation: check `order.discountedById` (staff) vs `order.discountId` (customer) vs neither (house account)
- [x] Routes: `GET/POST/PATCH/DELETE /discounts`, `GET/POST /staff-discount-auth`, `GET/POST /customer-discount-auth`
- [x] Frontend: discount picker at checkout, Manager approval widget on dashboard
- [x] Socket events: `order:staff_discount_pending`, `order:staff_discount_resolved`, `order:customer_discount_pending`, `order:customer_discount_resolved`

---

### Sub-track C: HR Module

- [x] New role: `HR_MANAGER` — cross-branch, manages profiles, leave, disciplinary records
- [x] `EmployeeProfile` model — 1:1 with User; employment type, dates, emergency contact
- [x] `LeaveBalance` model — auto-seeded on profile creation; one per `LeaveType` per year
- [x] `LeaveRequest` model — full approval lifecycle; working-days calculation (Mon–Fri)
- [x] `DisciplinaryRecord` model — category, action, expiry, acknowledgement
- [x] `HrDocument` model — Cloudinary upload, linked to profile/leave/disciplinary
- [x] Routes: all under `/hr` prefix — profiles, leave requests, disciplinary, documents, attendance analytics
- [x] Frontend: `/app/hr/*` pages — dashboard, staff profiles, leave calendar, disciplinary records, attendance analytics
- [x] FCM push notifications on leave approval/rejection and disciplinary record creation

---

### Sub-track D: Internal Communications

- [x] `DirectConversation` + `DirectMessage` models — 1:1 WhatsApp-style messaging
- [x] `Broadcast` + `BroadcastRecipient` models — one-to-many with read/ack tracking
- [x] `FormalNotice` + `FormalNoticeRecipient` models — HR notices with BullMQ escalation reminders
- [x] `BroadcastScope` enum: `COMPANY`, `BRANCH`, `ROLE_GROUP`
- [x] Routes: all under `/comms` prefix — conversations, messages, broadcasts, notices
- [x] Real-time delivery via Socket.io: `comms:dm_received`, `comms:broadcast_received`, `comms:notice_received`, `comms:typing_start/stop`, read receipts, acknowledgement events
- [x] BullMQ jobs: 24h reminder + 48h escalation FCM push for unacknowledged formal notices
- [x] Frontend: unified inbox UI — mobile slide-in, desktop side pane; delivery tracking panels

---

### Sub-track E: Incident Log & Order Edit Improvements

- [x] Manager can remove items from non-PENDING orders (`POST /orders/:id/remove-items`)
- [x] Added `ORDER_ITEM_REMOVED` and `PAYMENT_REJECTED` to `IncidentType` enum
- [x] Director cross-branch incident log page (`/app/director/incidents`) with branch filter
- [x] `IncidentLog` now includes `branchName` in serialized output for Director view
- [x] Rejected `PrepTicket` status excluded from order-ready check (prevents orders from getting stuck)

---

### Sub-track F: Staff Transfers

- [x] `StaffTransfer` model — immutable audit record per transfer
- [x] `POST /staff-transfers` — Director/SA moves staff member between branches (updates `user.organizationId`)
- [x] `GET /staff-transfers` — audit history

---

### Phase 8 Tests
- [x] Other income entry created and appears in daily summary totals
- [x] Staff discount auth flow: request → manager approval → discount applied to order
- [x] Customer discount auto-apply (no approval) vs approval-required flow
- [x] HR leave request: submit → approve → balance updated correctly
- [x] Leave request rejection returns pending days to available balance
- [x] Formal notice: issued → recipient receives FCM → 24h reminder fires if unacknowledged
- [x] Staff transfer updates `user.organizationId` and creates `StaffTransfer` audit record
- [x] Manager item removal voids prep tickets, recalculates totals, logs incident

---

## 15. Dependency Map

```
Phase 0 — Project Foundation
    |
    +-- Phase 1 — Auth & Branch Setup
            |
            +-- Phase 1.5 — Design System & Component Library
                    |
                    +-- Phase 2 — Menu Management
                    |       |
                    |       +-- Phase 3 — Order Management
                    |               |
                    |               +-- Phase 3.5 — Navigation, Shell Polish & FCM Web Push
                    |                       |
                    |                       +-- Phase 4 — Delivery Zones
                    |
                    +-- Phase 5 — Staff Management
                            |   (can run parallel with Phases 4 and 3.5)
                            |
                        Phase 6 — Reporting & Dashboards
                            (also depends on Phase 3.5)
```

### Page Inventory by Phase

| Page | Route | Roles | Phase |
|---|---|---|---|
| Login | /login | All | 1 |
| Profile | /app/profile | All | 1 |
| System Admin | /app/admin | SA | 1 |
| Staff Management | /app/manage/staff | MGR | 1 |
| All Phase 1 screens restyled | — | — | 1.5 |
| Menu Management | /app/admin/menu | SA, DIR | 2 |
| Menu Availability | /app/manage/menu | MGR | 2 |
| Waiter Dashboard | /app/dashboard | WAITER | 3 |
| Create Order | /app/orders/new | WAITER | 3 |
| Active Orders | /app/orders | WAITER | 3 |
| Waiter Order History | /app/history | WAITER | 3 |
| Kitchen Display | /app/kitchen | CHEF, KDS | 3 |
| Chef Dashboard | /app/dashboard | CHEF | 3 |
| Chef Order History | /app/history | CHEF | 3 |
| Barista Display | /app/barista | BARISTA, BDS | 3 |
| Barista Dashboard | /app/dashboard | BARISTA | 3 |
| Barista Order History | /app/history | BARISTA | 3 |
| All Phase 1–3 screens polished | — | All | 3.5 |
| Delivery Zones | /app/manage/delivery-zones | MGR | 4 |
| Shift Management | /app/manage/shifts | MGR | 5 |
| Staff Shifts | /app/shifts | WAITER, CHEF, BARISTA | 5 |
| Clock In/Out | /app/clock | WAITER, CHEF, BARISTA | 5 |
| Waiter Performance | /app/performance | WAITER | 6 |
| Chef Performance | /app/performance | CHEF | 6 |
| Barista Performance | /app/performance | BARISTA | 6 |
| Manager Dashboard | /app/manage/dashboard | MGR | 6 |
| Manager Reports | /app/manage/reports | MGR | 6 |
| Director Dashboard | /app/director | DIR | 6 |

Note: Phase 5 can be built in parallel with Phases 3.5 and 4 if two developers are available — it only depends on Phase 1.5. Phase 6 must always be last.

---

*This document is the authoritative development plan for Wendo RMS V1. Each phase must fully satisfy the Definition of Done before the next phase begins. Any deviation from this sequence requires explicit review — skipping phases or building out of order creates integration risk.*
