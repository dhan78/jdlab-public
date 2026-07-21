# Base image: corporate-managed Node 22 (RHEL 8 UBI). docker.io is blocked, so we
# use the sanctioned managed base image and point npm at the internal registry.
ARG NODE_IMAGE=jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/nodejs:22-stable
ARG NPM_REGISTRY=https://artifacts-read.gkp.jpmchase.net/artifactory/api/npm/npm

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ARG NPM_REGISTRY
RUN npm config set registry "$NPM_REGISTRY"

# --- Dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# PORTAL_JWT_SECRET is validated at module load during the build.
ARG PORTAL_JWT_SECRET
ENV PORTAL_JWT_SECRET=$PORTAL_JWT_SECRET
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production (standalone) ---
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Clear any inherited entrypoint from the managed base image.
ENTRYPOINT []

# NOTE: the managed minimal base has no shadow-utils (no useradd), so we run as
# the image's default user (root). Hardening to a non-root UID is a follow-up.

# Static assets
COPY --from=builder /app/public ./public
# Standalone server (bundles only required node_modules)
COPY --from=builder /app/.next/standalone ./
# Static build output (not included in standalone by default)
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Node-based healthcheck (RHEL minimal has no wget/curl guaranteed).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
