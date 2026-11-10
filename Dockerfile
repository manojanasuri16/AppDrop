# syntax=docker/dockerfile:1

# ---- deps: install with lockfile (native libsql binaries resolve for musl here) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce .next/standalone ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 && mkdir -p /extras \
 && (cp -R node_modules/@libsql /extras/ 2>/dev/null || true) \
 && (cp -R node_modules/libsql /extras/ 2>/dev/null || true)

# ---- runner: minimal, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/appdrop.db

RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs \
 && mkdir -p /app/data \
 && chown nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Safety net: libsql native bindings must be present even if output tracing misses them.
COPY --from=builder /extras/ ./node_modules/

USER nextjs
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
