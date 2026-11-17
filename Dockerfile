# --------- Public site: nginx serving the release published by the admin service ---------
# The admin container builds (prerenders) the site into the shared `site` volume and
# points /srv/site/current at the newest release; nginx serves that and proxies /admin/.
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
