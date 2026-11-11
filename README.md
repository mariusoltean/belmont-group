# belmont-group.ro

Static site for belmont-group.ro, served on this Mac mini (192.168.0.183) and
reverse-proxied by `cop-gateway` from `host.docker.internal:9095`.

Public traffic path: router -> M4 (192.168.0.108) -> this Mac.
The M4 front door does not need to know about this domain: its :443 SNI map and
its :80 catch-all both forward anything that is not SuperMed's to this Mac.

TLS: Let's Encrypt cert `belmont-group.ro` (covers apex + www) lives on THIS
machine at /etc/letsencrypt/live/belmont-group.ro/, issued with the
dns-cloudflare plugin and renewed by the root cron here. Apex is canonical;
www 301s to the apex.

## Replacing the placeholder with the real site

Drop the built files into `site/` (index.html at its root), then:

    cd ~/Dev/belmont-group
    docker compose build
    docker compose up -d

If the real site needs a build step (Angular/Vite/etc.), add a Node build stage
to the Dockerfile and copy its output into /usr/share/nginx/html instead of
`site/` — the sibling `poveste-cu-lumini-*` projects show that shape.

Do NOT run `docker compose up -d` inside ~/Dev/CorroboroDeployment on this
machine: `cop-gateway` depends_on cop-be/cop-fe and would revive stale prod
containers. Use `--no-deps cop-gateway`, or the hot-reload path:

    docker cp gateway/nginx.conf cop-gateway:/etc/nginx/conf.d/default.conf
    docker exec cop-gateway nginx -t && docker exec cop-gateway nginx -s reload
