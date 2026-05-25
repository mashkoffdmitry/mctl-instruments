# ---- build proxy ----
FROM node:22.11-alpine3.20 AS build-proxy
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# ---- build demo SPA ----
FROM node:22.11-alpine3.20 AS build-demo
WORKDIR /vue
COPY vue/package*.json ./
RUN npm ci
COPY vue/ ./
RUN npm run build:demo

# ---- runtime ----
FROM node:22.11-alpine3.20
RUN apk add --no-cache tini
ENV NODE_ENV=production
ENV PORT=8787
WORKDIR /app

# No runtime npm dependencies — ship compiled output + package.json
# (needed for "type": "module") + the static demo.
COPY package.json ./
COPY --from=build-proxy /app/dist ./dist
COPY --from=build-demo /vue/dist-demo ./public/demo

RUN addgroup -S app && adduser -S -G app -h /home/app app && chown -R app:app /app
USER app

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:8787/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
