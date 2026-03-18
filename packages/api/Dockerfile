# ─── Stage 1: Build ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json tsconfig.base.json ./

# Copy shared package (dependency of api)
COPY packages/shared/ packages/shared/

# Copy api package
COPY packages/api/ packages/api/

# Install all dependencies (workspace-aware)
RUN npm ci --workspace=packages/shared --workspace=packages/api

# Build shared first, then api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/api

# ─── Stage 2: Production ──────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy workspace root files for npm workspace resolution
COPY package.json package-lock.json ./

# Copy shared built output + package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json

# Copy api built output + package.json
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/api/package.json packages/api/package.json

# Install production dependencies only
RUN npm ci --omit=dev --workspace=packages/shared --workspace=packages/api

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the API
CMD ["node", "packages/api/dist/main.js"]
