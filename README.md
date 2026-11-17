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
hydrates it and the RO / EN / DE switch loads `public/i18n/<locale>.json`
(the German copy is our own translation and still needs a native review).

    npm install
    npm start              # dev server on http://localhost:4200
    npm test               # unit tests (Vitest)
    npm run build          # prerendered build -> dist/belmont-group/browser
    npm run serve:dist     # serve that build on http://localhost:4300

SEO lives in `src/index.html` (title, description, canonical, Open Graph / Twitter,
JSON-LD Organization + WebSite + WebPage), `public/robots.txt` and
`public/site.webmanifest`; `sitemap.xml` is generated from the content at build time.
`I18nService` updates `<html lang>`, title, description and OG tags on language switch.

Open items (keep the placeholders until the client supplies content): owner name,
team photos and bios, and the contact form backend
(`src/app/core/contact.service.ts` is a stub that delivers nothing).

## Content and the admin (`/admin/`)

Everything the client can edit lives in `content/`:

- `content/i18n/{ro,en,de}.json` — all texts
- `content/gallery.json` — gallery photos, order and captions (RO/EN/DE)
- `content/images.json` — the four fixed photos (hero, Angus, România, Transilvania)
- `content/uploads/` — photos uploaded from the admin (`<id>.jpg` + `w800/<id>.jpg`)

The admin (`admin/`, plain Node + `sharp` for photos) lets the single admin user
edit texts, add / replace / delete / reorder gallery photos and replace the fixed
photos. Originals up to 25 MB (JPEG, PNG, WebP, AVIF, TIFF; HEIC is converted in the
browser) are shrunk on the server to 2000px + 800px JPEG (turned upright, metadata such
as GPS dropped). A publish ships only the uploads in use, so a deleted photo is also gone
by direct URL; unused files are removed from `content/uploads` a day later. **Publish** runs `ng build` with the current
content into a new release folder and atomically switches `current` to it, so the
prerendered HTML (what Google sees) always matches the content.

Security: one account (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`, a salted scrypt hash —
the password itself is never stored), HttpOnly + Secure + SameSite=Strict session
cookie (8 h, server-side, cleared on restart), a custom header + Origin check against
CSRF, 5 failed logins per 15 minutes per IP, and strict validation (texts may change
values but not structure; image paths are whitelisted; uploads must decode as images).
`/admin/` is `noindex` (meta tag, `X-Robots-Tag`) and disallowed in `robots.txt`.

Local:

    cp .env.example .env
    printf %s '<password>' | npm run -s admin:hash   # paste the line into .env
    npm run admin:dev        # admin + published site on http://localhost:4310
    npm run test:admin       # admin API tests (node:test)

In production the content is a Docker volume: edits made in the admin are **not**
in git. `content/` in the repo is only the seed for a fresh volume. Back it up with:

    docker run --rm -v belmont-group_content:/c -v "$PWD":/b alpine tar czf /b/content-backup.tgz -C /c .

## Deploying

Two containers: `admin` (Node + Angular toolchain; builds the site on start and on
every publish into the shared `site` volume) and `belmont-group` (nginx on :9095,
serves `/srv/site/current` and proxies `/admin/` to the admin container).

    cd ~/Dev/belmont-group
    git pull
    # first time only: create .env (see .env.example)
    docker compose build
    docker compose up -d

Do NOT run `docker compose up -d` inside ~/Dev/CorroboroDeployment on this
machine: `cop-gateway` depends_on cop-be/cop-fe and would revive stale prod
containers. Use `--no-deps cop-gateway`, or the hot-reload path:

    docker cp gateway/nginx.conf cop-gateway:/etc/nginx/conf.d/default.conf
    docker exec cop-gateway nginx -t && docker exec cop-gateway nginx -s reload
