// Belmont Group admin: edit texts, gallery and main photos, then publish (rebuild) the site.
// No runtime dependencies: Node's http module, run with `node admin/server.ts` (type stripping).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { checkCredentials, LoginLimiter, SessionStore, type AdminAccount } from './lib/auth.ts';
import { ContentStore, isLocale, LOCALES, ValidationError } from './lib/content.ts';
import { Publisher } from './lib/publish.ts';

export interface AdminConfig {
  account: AdminAccount;
  appDir: string;
  siteDir: string;
  /** Local development only: also serve the published site at `/`. */
  serveSite: boolean;
  /** Extra hostnames accepted in the Origin header (the public domain behind the gateway). */
  allowedHosts?: string[];
}

const COOKIE = 'belmont_admin';
const UI_DIR = join(import.meta.dirname, 'public');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const ADMIN_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createAdminServer(config: AdminConfig) {
  const content = new ContentStore(join(config.appDir, 'content'), join(config.appDir, 'public'));
  const publisher = new Publisher(config.appDir, config.siteDir);
  const sessions = new SessionStore();
  const limiter = new LoginLimiter();

  function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    res.writeHead(status, { ...ADMIN_HEADERS, 'Content-Type': TYPES['.json'], ...headers });
    res.end(JSON.stringify(body));
  }

  function cookies(req: IncomingMessage): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function clientKey(req: IncomingMessage): string {
    // nginx sets X-Real-IP; the admin port is only reachable through it.
    const real = req.headers['x-real-ip'];
    return (typeof real === 'string' && real) || req.socket.remoteAddress || 'unknown';
  }

  function readBody(req: IncomingMessage, limit: number): Promise<unknown> {
    return new Promise((ok, fail) => {
      const type = req.headers['content-type'] ?? '';
      if (!type.startsWith('application/json')) return fail(new HttpError(415, 'JSON expected'));
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > limit) {
          fail(new HttpError(413, 'Request too large'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        try {
          ok(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          fail(new HttpError(400, 'Invalid JSON'));
        }
      });
      req.on('error', fail);
    });
  }

  /** CSRF: state-changing calls need our custom header (cross-site forms can't send it) and a same-origin Origin. */
  function checkCsrf(req: IncomingMessage): void {
    if (req.headers['x-requested-with'] !== 'belmont-admin') throw new HttpError(403, 'Forbidden');
    const origin = req.headers.origin;
    if (origin) {
      const allowed = new Set([req.headers.host, req.headers['x-forwarded-host'], ...(config.allowedHosts ?? [])]);
      let host = '';
      try {
        host = new URL(origin).host;
      } catch {
        // invalid Origin: rejected below
      }
      if (!allowed.has(host)) throw new HttpError(403, 'Forbidden');
    }
  }

  function requireSession(req: IncomingMessage): { email: string } {
    const session = sessions.get(cookies(req)[COOKIE]);
    if (!session) throw new HttpError(401, 'Not signed in');
    return session;
  }

  function serveFile(res: ServerResponse, file: string, headers: Record<string, string> = {}): void {
    if (!existsSync(file) || !statSync(file).isFile()) throw new HttpError(404, 'Not found');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers });
    createReadStream(file).pipe(res);
  }

  /** Static file under `root`, refusing anything that escapes it. */
  function safeJoin(root: string, rel: string): string {
    const full = resolve(root, normalize(rel).replace(/^([/\\])+/, ''));
    if (!full.startsWith(resolve(root))) throw new HttpError(404, 'Not found');
    return full;
  }

  async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const method = req.method ?? 'GET';

    if (path === 'login' && method === 'POST') {
      checkCsrf(req);
      const key = clientKey(req);
      if (limiter.blocked(key)) throw new HttpError(429, 'Prea multe încercări. Reîncercați peste 15 minute.');
      const body = (await readBody(req, 4096)) as { email?: unknown; password?: unknown };
      if (!checkCredentials(config.account, body.email, body.password)) {
        limiter.fail(key);
        throw new HttpError(401, 'E-mail sau parolă greșită.');
      }
      limiter.reset(key);
      const id = sessions.create(config.account.email);
      return send(res, 200, { email: config.account.email }, {
        'Set-Cookie': `${COOKIE}=${id}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
      });
    }

    if (path === 'logout' && method === 'POST') {
      checkCsrf(req);
      sessions.destroy(cookies(req)[COOKIE]);
      return send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }

    const session = requireSession(req);
    if (method !== 'GET') checkCsrf(req);

    if (path === 'session' && method === 'GET') return send(res, 200, session);

    if (path === 'content' && method === 'GET') {
      const i18n = Object.fromEntries(LOCALES.map((l) => [l, content.dictionary(l)]));
      return send(res, 200, { i18n, gallery: content.gallery(), images: content.images(), status: publisher.status() });
    }

    if (path === 'status' && method === 'GET') return send(res, 200, publisher.status());

    const textMatch = /^i18n\/([a-z]{2})$/.exec(path);
    if (textMatch && method === 'PUT') {
      const locale = textMatch[1];
      if (!isLocale(locale)) throw new HttpError(404, 'Unknown language');
      content.saveDictionary(locale, await readBody(req, 512 * 1024));
      publisher.markSaved();
      return send(res, 200, { ok: true, status: publisher.status() });
    }

    if (path === 'gallery' && method === 'PUT') {
      const gallery = content.saveGallery(await readBody(req, 1024 * 1024));
      publisher.markSaved();
      return send(res, 200, { gallery, status: publisher.status() });
    }

    if (path === 'images' && method === 'PUT') {
      const images = content.saveImages(await readBody(req, 64 * 1024));
      publisher.markSaved();
      return send(res, 200, { images, status: publisher.status() });
    }

    if (path === 'uploads' && method === 'POST') {
      const body = (await readBody(req, 20 * 1024 * 1024)) as { full?: unknown; thumb?: unknown };
      if (typeof body.full !== 'string' || typeof body.thumb !== 'string') throw new HttpError(400, 'Missing image');
      const image = content.saveUpload(Buffer.from(body.full, 'base64'), Buffer.from(body.thumb, 'base64'));
      return send(res, 201, image);
    }

    if (path === 'publish' && method === 'POST') {
      content.removeUnusedUploads();
      publisher.publish().catch(() => undefined); // status reports failures
      return send(res, 202, publisher.status());
    }

    throw new HttpError(404, 'Not found');
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://admin.local');
    const path = decodeURIComponent(url.pathname);
    try {
      if (path === '/admin') {
        res.writeHead(301, { Location: '/admin/' });
        return res.end();
      }
      if (path.startsWith('/admin/api/')) return await api(req, res, path.slice('/admin/api/'.length));
      if (path.startsWith('/admin/media/')) {
        requireSession(req);
        const file = content.resolveMedia(path.slice('/admin/media/'.length));
        if (!file) throw new HttpError(404, 'Not found');
        return serveFile(res, file, { 'Cache-Control': 'private, max-age=300', 'X-Robots-Tag': 'noindex' });
      }
      if (path === '/admin/' || path.startsWith('/admin/')) {
        const rel = path === '/admin/' ? 'index.html' : path.slice('/admin/'.length);
        return serveFile(res, safeJoin(UI_DIR, rel), ADMIN_HEADERS);
      }
      if (config.serveSite) {
        const root = join(config.siteDir, 'current');
        let file = safeJoin(root, path === '/' ? 'index.html' : path);
        if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
        return serveFile(res, file, { 'Cache-Control': 'no-cache' });
      }
      throw new HttpError(404, 'Not found');
    } catch (err) {
      if (res.headersSent) return res.end();
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      if (err instanceof ValidationError) return send(res, 400, { error: err.message });
      console.error(err);
      return send(res, 500, { error: 'Server error' });
    }
  });
  return { server, publisher };
}

// ---- entry point -------------------------------------------------------------
if (import.meta.main) {
  const env = process.env;
  const passwordHash = env['ADMIN_PASSWORD_HASH'] ?? '';
  if (!passwordHash.startsWith('scrypt$')) {
    console.error('ADMIN_PASSWORD_HASH is not set. Create it with: printf %s "<password>" | npm run -s admin:hash');
    process.exit(1);
  }
  const appDir = resolve(env['APP_DIR'] ?? join(import.meta.dirname, '..'));
  const siteDir = resolve(env['SITE_DIR'] ?? join(appDir, 'site-releases'));
  const { server, publisher } = createAdminServer({
    account: { email: env['ADMIN_EMAIL'] ?? 'admin@belmont-group.ro', passwordHash },
    appDir,
    siteDir,
    serveSite: env['SERVE_SITE'] === '1',
    allowedHosts: (env['ADMIN_ALLOWED_HOSTS'] ?? 'belmont-group.ro,www.belmont-group.ro').split(',').map((h) => h.trim()),
  });
  const port = Number(env['PORT'] ?? 3000);
  server.listen(port, () => console.log(`Belmont admin on http://localhost:${port}/admin/`));

  // Build the site from the current code + content when the container starts.
  if (env['PUBLISH_ON_START'] !== '0') {
    console.log('Building the site…');
    publisher.publish().then(
      () => console.log('Site published.'),
      (e) => console.error('Initial build failed:', e instanceof Error ? e.message : e),
    );
  }
}
