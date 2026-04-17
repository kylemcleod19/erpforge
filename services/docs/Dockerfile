# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY web/package*.json web/
COPY services/interviewer/package*.json services/interviewer/
COPY services/coder/package*.json services/coder/
COPY services/docs/package*.json services/docs/
RUN npm ci

# docs-generator imports from dev-agent which imports from interviewer.
COPY tsconfig.json ./
COPY schemas/ schemas/
COPY interviewer/ interviewer/
COPY dev-agent/ dev-agent/
COPY services/docs/ services/docs/

RUN npm run build --workspace=@erpforge/docs-service

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

COPY schemas/ schemas/

# Compiled output:
#   services/docs/dist/services/docs/server.js   — entry point
#   services/docs/dist/dev-agent/                — compiled shared lib
#   services/docs/dist/interviewer/              — compiled shared lib (transitive)
COPY --from=builder /app/services/docs/dist services/docs/dist

EXPOSE 3003
CMD ["node", "services/docs/dist/services/docs/server.js"]
