# Build context is the monorepo root (see docker/docker-compose.yml).
# npm workspaces need the root manifest + every workspace's package.json
# present to resolve correctly, even though this image only ships apps/api.

FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/api
COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
COPY apps/api/prisma ./prisma

RUN chown -R node:node /repo
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
