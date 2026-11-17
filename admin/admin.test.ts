import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { checkCredentials, hashPassword, LoginLimiter, SessionStore, verifyPassword } from './lib/auth.ts';
import { jpegSize, validateDictionary } from './lib/content.ts';
import { buildSitemap } from './lib/sitemap.ts';
import { createAdminServer } from './server.ts';

const REPO = join(import.meta.dirname, '..');
// Smallest valid-looking JPEG header: SOI + SOF0 with 3x2 px.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);

describe('auth', () => {
  const hash = hashPassword('correct horse battery');

  it('verifies scrypt hashes and rejects wrong passwords', () => {
    assert.ok(verifyPassword('correct horse battery', hash));
    assert.ok(!verifyPassword('wrong', hash));
    assert.ok(!verifyPassword('x', 'garbage'));
  });

  it('needs both the right email (any case) and password', () => {
    const account = { email: 'admin@belmont-group.ro', passwordHash: hash };
    assert.ok(checkCredentials(account, 'Admin@Belmont-Group.ro ', 'correct horse battery'));
    assert.ok(!checkCredentials(account, 'other@belmont-group.ro', 'correct horse battery'));
    assert.ok(!checkCredentials(account, 'admin@belmont-group.ro', 'nope'));
    assert.ok(!checkCredentials(account, undefined, undefined));
  });

  it('expires and revokes sessions', () => {
    const store = new SessionStore(1000);
    const id = store.create('a@b.ro', 0);
    assert.deepEqual(store.get(id, 500), { email: 'a@b.ro' });
    assert.equal(store.get(id, 2000), null);
    const id2 = store.create('a@b.ro');
    store.destroy(id2);
    assert.equal(store.get(id2), null);
  });

  it('blocks a client after 5 failed logins', () => {
    const limiter = new LoginLimiter(5, 50, 1000);
    for (let i = 0; i < 5; i++) limiter.fail('ip', 0);
    assert.ok(limiter.blocked('ip', 10));
    assert.ok(!limiter.blocked('other', 10));
    assert.ok(!limiter.blocked('ip', 2000));
  });
});

describe('content validation', () => {
  const current = { a: 'x', list: [{ t: 'y' }], nested: { b: 'z' } };

  it('accepts changed values with the same shape', () => {
    validateDictionary({ a: 'new', list: [{ t: 'n' }], nested: { b: 'q' } }, current);
  });

  it('rejects added/removed keys, list length changes and non-text values', () => {
    assert.throws(() => validateDictionary({ ...current, extra: 'x' }, current));
    assert.throws(() => validateDictionary({ ...current, list: [] }, current));
    assert.throws(() => validateDictionary({ ...current, a: 5 }, current));
    assert.throws(() => validateDictionary({ ...current, a: 'x'.repeat(6000) }, current));
  });

  it('reads JPEG dimensions and rejects other files', () => {
    assert.deepEqual(jpegSize(JPEG), { width: 3, height: 2 });
    assert.equal(jpegSize(Buffer.from('<svg/>')), null);
  });

  it('builds a sitemap with each image once', () => {
    const xml = buildSitemap([{ file: 'a.jpg' }, { file: 'a.jpg' }, { file: 'b.jpg' }], new Date('2026-01-02'));
    assert.equal(xml.match(/<image:loc>/g)?.length, 2);
    assert.match(xml, /<lastmod>2026-01-02<\/lastmod>/);
  });
});

describe('admin HTTP API', () => {
  let dir: string;
  let base: string;
  let close: () => void;
  const password = 'Test-password-123';

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'belmont-admin-'));
    cpSync(join(REPO, 'content'), join(dir, 'content'), { recursive: true });
    mkdirSync(join(dir, 'public/images'), { recursive: true });
    cpSync(join(REPO, 'public/images'), join(dir, 'public/images'), { recursive: true });
    const { server } = createAdminServer({
      account: { email: 'admin@belmont-group.ro', passwordHash: hashPassword(password) },
      appDir: dir,
      siteDir: join(dir, 'site'),
      serveSite: false,
    });
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  after(() => {
    close();
    rmSync(dir, { recursive: true, force: true });
  });

  const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'belmont-admin',
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...(init.headers as Record<string, string>),
      },
    });

  async function login(): Promise<string> {
    const res = await call('/admin/api/login', { method: 'POST', body: JSON.stringify({ email: 'admin@belmont-group.ro', password }) });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie') ?? '';
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Secure/);
    return cookie.split(';')[0];
  }

  it('serves the admin page with noindex headers', async () => {
    const res = await fetch(base + '/admin/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.match(await res.text(), /<meta name="robots" content="noindex/);
  });

  it('refuses the API without a session and without the CSRF header', async () => {
    assert.equal((await call('/admin/api/content')).status, 401);
    const cookie = await login();
    const res = await fetch(base + '/admin/api/gallery', { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '[]' });
    assert.equal(res.status, 403);
    const crossSite = await call('/admin/api/gallery', { method: 'PUT', cookie, body: '[]', headers: { Origin: 'https://evil.example' } });
    assert.equal(crossSite.status, 403);
  });

  it('rejects a wrong password', async () => {
    const res = await call('/admin/api/login', { method: 'POST', body: JSON.stringify({ email: 'admin@belmont-group.ro', password: 'nope' }) });
    assert.equal(res.status, 401);
  });

  it('saves texts that keep the same shape and refuses others', async () => {
    const cookie = await login();
    const { i18n } = (await (await call('/admin/api/content', { cookie })).json()) as { i18n: Record<string, any> };
    const ro = i18n.ro;
    ro.hero.title = 'Titlu nou';
    assert.equal((await call('/admin/api/i18n/ro', { method: 'PUT', cookie, body: JSON.stringify(ro) })).status, 200);
    assert.equal(JSON.parse(readFileSync(join(dir, 'content/i18n/ro.json'), 'utf8')).hero.title, 'Titlu nou');
    ro.hero.injected = 'x';
    assert.equal((await call('/admin/api/i18n/ro', { method: 'PUT', cookie, body: JSON.stringify(ro) })).status, 400);
    assert.equal((await call('/admin/api/i18n/fr', { method: 'PUT', cookie, body: '{}' })).status, 404);
  });

  it('uploads a JPEG, adds it to the gallery and refuses unknown files', async () => {
    const cookie = await login();
    const up = await call('/admin/api/uploads', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ full: JPEG.toString('base64'), thumb: JPEG.toString('base64') }),
    });
    assert.equal(up.status, 201);
    const image = (await up.json()) as { file: string; width: number; height: number };
    assert.match(image.file, /^uploads\/[a-f0-9]{16}\.jpg$/);
    assert.deepEqual([image.width, image.height], [3, 2]);

    const bad = await call('/admin/api/uploads', { method: 'POST', cookie, body: JSON.stringify({ full: 'PHN2Zz4=', thumb: 'PHN2Zz4=' }) });
    assert.equal(bad.status, 400);

    const gallery = [{ ...image, caption: { ro: 'Nou', en: '', de: '' } }];
    assert.equal((await call('/admin/api/gallery', { method: 'PUT', cookie, body: JSON.stringify(gallery) })).status, 200);
    const traversal = [{ file: '../../etc/passwd', width: 1, height: 1, caption: { ro: 'x', en: '', de: '' } }];
    assert.equal((await call('/admin/api/gallery', { method: 'PUT', cookie, body: JSON.stringify(traversal) })).status, 400);
    const noCaption = [{ ...image, caption: { ro: ' ', en: '', de: '' } }];
    assert.equal((await call('/admin/api/gallery', { method: 'PUT', cookie, body: JSON.stringify(noCaption) })).status, 400);

    const mediaRes = await fetch(`${base}/admin/media/${image.file}`, { headers: { Cookie: cookie } });
    assert.equal(mediaRes.status, 200);
    assert.equal((await fetch(`${base}/admin/media/${image.file}`)).status, 401);
    assert.equal((await fetch(`${base}/admin/media/../../.env`, { headers: { Cookie: cookie } })).status, 404);
  });

  it('logs out', async () => {
    const cookie = await login();
    assert.equal((await call('/admin/api/logout', { method: 'POST', cookie, body: '{}' })).status, 200);
    assert.equal((await call('/admin/api/session', { cookie })).status, 401);
  });
});
