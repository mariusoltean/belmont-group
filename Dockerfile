# --------- Static site served by nginx ---------
# No build step yet: the placeholder in site/ is copied as-is.
# When the real site code arrives, either drop the built files into site/
# or add a Node build stage here (see the poveste-cu-lumini sites for that shape).
FROM nginx:1.27-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY site/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
