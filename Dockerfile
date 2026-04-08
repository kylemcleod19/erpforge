FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY web/package*.json web/
RUN npm ci

# Copy source
COPY . .

# Compile TypeScript (interviewer + dev-agent packages)
RUN npx tsc

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
COPY --from=builder /app/web/.next/standalone ./

# Explicitly copy the standalone node_modules so all dependencies are present.
COPY --from=builder /app/web/.next/standalone/node_modules ./node_modules

# Static assets must be served from the path the standalone server expects.
COPY --from=builder /app/web/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
