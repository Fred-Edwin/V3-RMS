# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency files first (better layer caching — only reinstalls when these change)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for TypeScript build)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm prisma:generate

# Copy source and compile TypeScript
COPY . .
RUN pnpm build

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client in the production image
RUN pnpm prisma:generate

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user for security
RUN addgroup -S wendo && adduser -S wendo -G wendo
USER wendo

EXPOSE 4000

CMD ["node", "dist/server.js"]
