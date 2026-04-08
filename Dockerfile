FROM node:22-alpine AS builder
WORKDIR /app

# Bust the Docker layer cache on every deploy by passing a unique BUILD_ID.
# Railway (or any CI) should supply: --build-arg BUILD_ID=<commit-sha-or-timestamp>
ARG BUILD_ID=default
RUN echo "Build ID: $BUILD_ID"

# Install dependencies
COPY package*.json ./
COPY web/package*.json web/
RUN npm ci

# Copy source
COPY . .

# Force rebuild by referencing BUILD_ID so the layer above is never reused
# when a new BUILD_ID is supplied, guaranteeing the Next.js build always runs.
RUN echo "Building with ID: $BUILD_ID"
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
