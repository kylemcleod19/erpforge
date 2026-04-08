FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY web/package*.json web/
RUN npm ci

# Copy source
COPY . .

# Build Next.js (standalone output)
# Force cache invalidation so the build always runs on every push.
RUN date > /tmp/build-timestamp.txt
RUN npm run build --workspace=web

# ---- Deploy image ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output is self-contained (includes its own node_modules).
# Copy its contents directly so server.js lands at /app/server.js.
COPY --from=builder /app/web/.next/standalone ./

# Static assets must be copied alongside the standalone server.
COPY --from=builder /app/web/.next/static ./web/.next/static

EXPOSE 3000
CMD ["node", "server.js"]
