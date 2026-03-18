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

# Copy source and compile TypeScript (pnpm build runs prisma:generate + tsc)
COPY . .
RUN pnpm build

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy everything from builder — node_modules includes the generated Prisma client
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Run as non-root user for security
RUN addgroup -S wendo && adduser -S wendo -G wendo
USER wendo

EXPOSE 4000

CMD ["node", "dist/server.js"]
