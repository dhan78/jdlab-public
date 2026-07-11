FROM node:22-alpine AS base

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# --- Dependencies ---
# --- Dependencies Stage ---
FROM base AS deps
COPY package.json ./
# Use native npm to install dependencies—it runs sharp's build scripts automatically
RUN npm install

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Add these lines to satisfy Next.js 15 build validation
ARG PORTAL_JWT_SECRET
ENV PORTAL_JWT_SECRET=$PORTAL_JWT_SECRET
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Production (standalone) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Static assets
COPY --from=builder /app/public ./public

# Standalone server (includes only required node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static build output (not included in standalone by default)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
