# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app

# Copy all workspace package manifests so npm can hoist deps correctly.
COPY package*.json ./
COPY web/package*.json web/
COPY services/interviewer/package*.json services/interviewer/
COPY services/coder/package*.json services/coder/
COPY services/docs/package*.json services/docs/
RUN npm ci

# Copy source files needed to compile this service.
# schemas/ is read at runtime by interviewer/validate.ts via process.cwd().
COPY tsconfig.json ./
COPY schemas/ schemas/
COPY interviewer/ interviewer/
COPY services/interviewer/ services/interviewer/

# Compile TypeScript. tsc runs from services/interviewer/ (workspace dir).
# outDir=dist + rootDir=../../ → output lands at services/interviewer/dist/
RUN npm run build --workspace=@erpforge/interviewer-service

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install production deps only (mirrors builder workspace layout for hoisting).
COPY package*.json ./
COPY web/package*.json web/
COPY services/interviewer/package*.json services/interviewer/
COPY services/coder/package*.json services/coder/
COPY services/docs/package*.json services/docs/
RUN npm ci --omit=dev

# Runtime: schemas/ must be at /app/schemas/ (process.cwd() = /app).
COPY schemas/ schemas/

# Compiled output. The dist tree mirrors the source tree from the repo root:
#   services/interviewer/dist/services/interviewer/server.js  — entry point
#   services/interviewer/dist/interviewer/                    — compiled shared lib
COPY --from=builder /app/services/interviewer/dist services/interviewer/dist

EXPOSE 3001
CMD ["node", "services/interviewer/dist/services/interviewer/server.js"]
