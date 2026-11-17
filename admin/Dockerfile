# Belmont admin: edits content/ and rebuilds (prerenders) the site into /srv/site.
# Needs the full Angular toolchain because "Publish" runs `ng build`.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# content/ is the seed for the named volume mounted at /app/content on first start.
RUN mkdir -p /srv/site content/uploads/w800 .angular && chown -R node:node /app/content /app/.angular /srv/site

ENV NODE_ENV=production APP_DIR=/app SITE_DIR=/srv/site PORT=3000 NG_CLI_ANALYTICS=false
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/admin/ >/dev/null 2>&1 || exit 1

CMD ["node", "admin/server.ts"]
