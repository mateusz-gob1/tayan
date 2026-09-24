# Game server image. The client is static and deployed separately (see docs/deployment.md).
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
# install with only the manifests first so the dependency layer is cached
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @tayan/server...
COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY apps/server apps/server
RUN pnpm --filter @tayan/server build

FROM node:22-slim
ENV NODE_ENV=production PORT=3001
WORKDIR /app
# the bundle is self-contained: no node_modules needed at runtime
COPY --from=build /app/apps/server/dist/index.js ./index.js
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
