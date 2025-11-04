# syntax=docker/dockerfile:1.5

# ============================================================================
# Build Stage
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache python3 make g++ openssl

# Copy dependency files for layer caching
COPY --link package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && \
    npm cache clean --force

# Copy Prisma schema
COPY --link prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy application source
COPY --link . .

# Build TypeScript application
RUN npm run build

# ============================================================================
# Runtime Stage
# ============================================================================
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache tini curl openssl

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs appuser && \
    chown -R appuser:nodejs /app

# Copy dependencies and built application from builder
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package*.json ./
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    PORT=3000

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER appuser

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start application
CMD ["node", "dist/server.js"]