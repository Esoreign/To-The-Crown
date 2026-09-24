# ---------------------------------------------------------------------------
# To The Crown — image multi-cibles
#   docker build -f infra/docker/Dockerfile --target server .
#   docker build -f infra/docker/Dockerfile --target web .
# ---------------------------------------------------------------------------
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /repo

# --- Dépendances (couche mise en cache tant que les manifestes ne changent pas)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
COPY packages/game-core/package.json packages/game-core/
COPY tests/e2e/package.json tests/e2e/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- Compilation
FROM deps AS build
COPY . .
RUN pnpm --filter @ttc/server build \
 && pnpm --filter @ttc/web build \
 && pnpm --filter @ttc/server deploy --legacy --prod /out/server \
 && cp -r apps/server/dist /out/server/dist \
 && cp -r database /out/database

# --- Serveur de jeu
FROM node:${NODE_VERSION} AS server
ENV NODE_ENV=production PORT=3000 MIGRATIONS_DIR=/database/migrations
WORKDIR /app
RUN addgroup -S ttc && adduser -S ttc -G ttc
COPY --from=build --chown=ttc:ttc /out/server /app
COPY --from=build --chown=ttc:ttc /out/database /database
USER ttc
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# Migrations et données de référence avant le démarrage (idempotents).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && exec node dist/index.js"]

# --- Client web (nginx)
FROM nginx:1.27-alpine AS web
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
