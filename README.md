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

## The site

Angular 22 app (standalone components, signals, zoneless), built from the design
handoff in `handoff/` (see `CLAUDE.md` for the build brief). The single page is
prerendered at build time (`outputMode: "static"`), so `dist/belmont-group/browser/`
is plain static files with the full Romanian content in `index.html`; Angular
hydrates it and the RO / EN switch loads `public/i18n/<locale>.json`.

    npm install
    npm start              # dev server on http://localhost:4200
    npm test               # unit tests (Vitest)
    npm run build          # prerendered build -> dist/belmont-group/browser
    npm run serve:dist     # serve that build on http://localhost:4300

SEO lives in `src/index.html` (title, description, canonical, Open Graph / Twitter,
JSON-LD Organization + WebSite + WebPage), `public/robots.txt`,
`public/sitemap.xml` (with image entries) and `public/site.webmanifest`.
`I18nService` updates `<html lang>`, title, description and OG tags on language switch.

Open items (keep the placeholders until the client supplies content): owner name,
team photos and bios, contact email / phone, and the contact form backend
(`src/app/core/contact.service.ts` is a stub that delivers nothing).

## Deploying

The Dockerfile builds the app in a Node stage and copies the output into nginx:

    cd ~/Dev/belmont-group
    git pull
    docker compose build
    docker compose up -d

Do NOT run `docker compose up -d` inside ~/Dev/CorroboroDeployment on this
machine: `cop-gateway` depends_on cop-be/cop-fe and would revive stale prod
containers. Use `--no-deps cop-gateway`, or the hot-reload path:

    docker cp gateway/nginx.conf cop-gateway:/etc/nginx/conf.d/default.conf
    docker exec cop-gateway nginx -t && docker exec cop-gateway nginx -s reload
