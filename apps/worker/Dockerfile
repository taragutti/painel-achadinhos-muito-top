FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json turbo.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/providers/package.json packages/providers/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM dependencies AS build

COPY apps/worker apps/worker
COPY packages/database packages/database
COPY packages/providers packages/providers
COPY packages/shared packages/shared

RUN npm run build --workspace=@achadinhos/shared \
  && npm run build --workspace=@achadinhos/database \
  && npm run build --workspace=@achadinhos/providers \
  && npm run build --workspace=@achadinhos/worker

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  APP_RUNTIME=worker \
  DEMO_MODE=true \
  PROVIDER_MODE=mock \
  MOCK_PROVIDERS=true \
  SEND_LIVE=false \
  WHATSAPP_ENABLED=false \
  WORKER_HEALTH_HOST=0.0.0.0 \
  WORKER_HEALTH_PORT=9464 \
  WHATSAPP_SESSION_DIR=/var/lib/achadinhos/whatsapp-session

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/worker/package.json apps/worker/package.json
COPY --from=build /app/apps/worker/dist apps/worker/dist
COPY --from=build /app/packages/database/package.json packages/database/package.json
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/prisma packages/database/prisma
COPY --from=build /app/packages/providers/package.json packages/providers/package.json
COPY --from=build /app/packages/providers/dist packages/providers/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist

RUN mkdir -p /var/lib/achadinhos/whatsapp-session \
  && chown -R node:node /app /var/lib/achadinhos

USER node

EXPOSE 9464
VOLUME ["/var/lib/achadinhos/whatsapp-session"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || process.env.WORKER_HEALTH_PORT || 9464}/health`, { headers: { authorization: `Bearer ${process.env.WORKER_HEALTH_TOKEN || ''}` } }).then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "apps/worker/dist/index.js"]
