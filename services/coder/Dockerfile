# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY web/package*.json web/
COPY services/interviewer/package*.json services/interviewer/
COPY services/coder/package*.json services/coder/
COPY services/docs/package*.json services/docs/
RUN npm ci

# Copy source files needed to compile this service.
# dev-agent imports interviewer/validate.ts, so both packages are required.
COPY tsconfig.json ./
COPY schemas/ schemas/
COPY interviewer/ interviewer/
COPY dev-agent/ dev-agent/
COPY services/coder/ services/coder/

RUN npm run build --workspace=@erpforge/coder-service

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY web/package*.json web/
COPY services/interviewer/package*.json services/interviewer/
COPY services/coder/package*.json services/coder/
COPY services/docs/package*.json services/docs/
RUN npm ci --omit=dev

# Runtime: schemas/ must be at /app/schemas/
COPY schemas/ schemas/

# Compiled output:
#   services/coder/dist/services/coder/server.js   — entry point
#   services/coder/dist/dev-agent/                 — compiled shared lib
#   services/coder/dist/interviewer/               — compiled shared lib (transitive)
COPY --from=builder /app/services/coder/dist services/coder/dist

EXPOSE 3002
CMD ["node", "services/coder/dist/services/coder/server.js"]
