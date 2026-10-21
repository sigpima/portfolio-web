# Portfolio web (Next.js standalone). Modeled on fashion-web/frontend/Dockerfile.
#
# NOTE: `next/font/google` downloads the fonts at BUILD time, so the machine that
# runs `docker build` needs internet access.
#
# SITE_URL is used while pages are statically generated (canonical / hreflang /
# Open Graph URLs), so it is a BUILD argument. It is also kept as a runtime ENV.
# By default the build fails if SITE_URL is empty (REQUIRE_SITE_URL=1); pass
# --build-arg REQUIRE_SITE_URL=0 for a local throwaway image.
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ARG SITE_URL=""
ARG REQUIRE_SITE_URL=1
ENV SITE_URL=$SITE_URL \
    REQUIRE_SITE_URL=$REQUIRE_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ARG SITE_URL=""
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=$SITE_URL

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
