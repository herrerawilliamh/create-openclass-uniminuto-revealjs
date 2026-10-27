# syntax=docker/dockerfile:1
# OpenClass Live — imagen mínima. Solo src/ y public/ del servicio: ningún recurso institucional,
# Markdown académico ni presentación entra en la imagen.
# Base fijada por versión y digest (node:22.23.1-alpine, índice multiarquitectura).
ARG NODE_IMAGE=node:22.23.1-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM ${NODE_IMAGE}
ENV NODE_ENV=production PORT=3000
WORKDIR /app
# Código propiedad de root y solo lectura para el usuario de ejecución (node, uid 1000).
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts/hash-password.mjs ./scripts/hash-password.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "src/server.mjs"]
