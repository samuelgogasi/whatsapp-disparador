FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# The lockfile contains a public Git dependency resolved with an SSH URL.
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npm run prisma:generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 WHATSAPP_AUTH_DIR=/app/.sessions
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node public ./public
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts/start.mjs ./scripts/start.mjs
RUN mkdir -p /app/.sessions && chown node:node /app/.sessions
USER node
EXPOSE 3333
CMD ["node", "scripts/start.mjs"]
