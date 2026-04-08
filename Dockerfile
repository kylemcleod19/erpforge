FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY web/package*.json web/
RUN npm ci

# Copy source
COPY . .

# Build Next.js (standalone output)
RUN npm run build --workspace=web

# ---- Deploy image ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output is self-contained (includes its own node_modules).
# Copy its contents directly so server.js lands at /app/server.js.
# Next.js mirrors the monorepo path structure inside standalone, so the
# app's built chunks live under web/.next/server/ within this directory.
COPY --from=builder /app/web/.next/standalone ./

# Static assets must be placed at the path server.js expects: web/.next/static
# (mirroring the monorepo layout where the web workspace is at /app/web).
COPY --from=builder /app/web/.next/static ./web/.next/static

EXPOSE 3000
CMD ["node", "server.js"]
