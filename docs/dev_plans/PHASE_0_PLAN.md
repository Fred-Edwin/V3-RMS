PHASE 0 — PROJECT FOUNDATION: Codex Task List

BACKEND

Initialise Node.js + Express + TypeScript project in backend/
Configure tsconfig.json with strict mode enabled
Configure ESLint and Prettier for consistent code style
Create folder structure: controllers/, services/, repositories/, middleware/, routes/, validators/, sockets/, jobs/, utils/, types/ under backend/src/
Install Prisma and connect to Supabase PostgreSQL instance
Write schema.prisma with all models from docs/DATA_MODEL.md
Run initial Prisma migration to create all tables
Verify all tables, indexes, and constraints are created correctly on Supabase
Create config/redis.ts — Redis client singleton connected to Upstash Redis
Verify Redis connection with a ping test
Create Express app with JSON body parsing
Set up global error handling middleware
Set up request logging middleware using Pino
Set up CORS configuration (allow Vercel frontend domain)
Set up rate limiting middleware
Create GET /health endpoint returning database and Redis connectivity status
Set up response compression (gzip)
Attach Socket.io to the Express HTTP server
Set up branch room structure in Socket.io
Verify a test client can connect and join a Socket.io room
Configure BullMQ notificationQueue and reportQueue backed by Upstash Redis
Set up BullMQ job processor skeletons (no actual job logic yet)
Create .env.example with all required environment variables documented
Configure all environment variables on Render (staging and production)
Verify all connections (DB, Redis, Socket.io) work in the staging environment
FRONTEND

Initialise Next.js 14 (App Router) + TypeScript project in frontend/
Install and configure Tailwind CSS with the full theme from docs/DESIGN_SYSTEM.md Section 13
Install and configure Zustand
Install and configure fetch wrapper for API calls
Install lucide-react for icons
Set up Google Fonts — Cormorant Garamond and DM Sans in layout.tsx
Create folder structure: app/, components/ui/, components/orders/, components/kitchen/, components/menu/, components/staff/, components/dashboard/, hooks/, services/, store/, lib/, types/ under frontend/
Create route groups (auth) and app in frontend/app/
Create placeholder page: /login
Create placeholder page: /app/dashboard
Create placeholder page: /app/orders
Create placeholder page: /app/orders/new
Create placeholder page: /app/history
Create placeholder page: /app/performance
Create placeholder page: /app/shifts
Create placeholder page: /app/clock
Create placeholder page: /app/profile
Create placeholder page: /app/kitchen
Create placeholder page: /app/barista
Create placeholder page: /app/manage/dashboard
Create placeholder page: /app/manage/staff
Create placeholder page: /app/manage/menu
Create placeholder page: /app/manage/shifts
Create placeholder page: /app/manage/delivery-zones
Create placeholder page: /app/manage/reports
Create placeholder page: /app/director
Create placeholder page: /app/admin
Create Next.js middleware skeleton for auth-based route protection
Install Socket.io client package
Create lib/socket.ts — socket initialisation and connection management skeleton
CI/CD

Connect GitHub repository to Render for backend auto-deploy on push to main
Connect GitHub repository to Vercel for frontend auto-deploy on push to main
Set up staging branch with auto-deploy to staging environment
Verify full deploy pipeline: push → auto build → live on staging
PHASE 0 TESTS

Write and run test: GET /health returns 200 with correct payload
Verify database connection is live on staging
Verify Redis connection is live on staging
Verify Socket.io accepts a test connection on staging