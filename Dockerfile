# syntax=docker/dockerfile:1

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install --global pnpm@11.10.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Full install and build: Astro server, plus the startup and scrape CLI bundles.
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production dependencies only (includes the native better-sqlite3 and sharp binaries).
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
# better-sqlite3 ships binaries for 8 platforms plus SQLite's C sources; keep only this platform's binary.
RUN cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 \
  && rm -rf deps src \
  && find prebuilds -type f ! -name "$(node -p 'process.platform + "-" + process.arch').node" -delete

# Same Debian release as node:24-slim, with only the node binary copied in: npm and corepack aren't needed at runtime.
FROM debian:bookworm-slim
COPY --from=base /usr/local/bin/node /usr/local/bin/node
RUN groupadd --gid 1000 node && useradd --uid 1000 --gid node --create-home node
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DATABASE_PATH=/app/data/app.db
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY package.json ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME /app/data
EXPOSE 4321
# boot.mjs applies migrations and starts the weekly scrape scheduler, then the Astro server starts.
# Manual scrape: docker compose exec app node dist/scrape.mjs [--show "lion king"]
CMD ["node", "--import", "./dist/boot.mjs", "dist/server/entry.mjs"]
