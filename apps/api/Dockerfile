# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/apps/api

# Copy only the API package.json for dependency install
COPY apps/api/package*.json ./

# Install all deps (including devDeps needed for build)
RUN npm ci

# Copy API source
COPY apps/api/ ./

# Compile TypeScript → dist/
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app/apps/api

# Production deps only
COPY --from=builder /app/apps/api/package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and migrations
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/migrations ./migrations

# Use non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Railway injects PORT automatically
EXPOSE 3000

CMD ["node", "dist/server.js"]
