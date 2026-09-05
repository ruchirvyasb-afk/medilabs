# ── Build stage ────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────
FROM node:20-slim

# Security: run as non-root
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src/ ./src/
COPY db/ ./db/
COPY scripts/ ./scripts/

# Copy frontend assets (served by Express)
COPY index.html style.css app.js ./
COPY enhancements.css enhancements.js ./
COPY extra.css more-enhancements.css more-enhancements.js ./
COPY summary.js verifier.js ./

# Create data dir for SQLite (dev/fallback only)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE ${PORT}

CMD ["node", "src/index.js"]
