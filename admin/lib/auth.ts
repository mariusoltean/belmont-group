import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * One admin user. The password is never stored: only a salted scrypt hash
 * (`scrypt$N$r$p$saltB64$hashB64`), produced by `npm run admin:hash`.
 */
const KEY_LENGTH = 64;
const DEFAULT_COST = { N: 2 ** 15, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number): Buffer {
  return scryptSync(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r });
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const { N, r, p } = DEFAULT_COST;
  const hash = scrypt(password, salt, N, r, p);
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (!N || !r || !p || expected.length !== KEY_LENGTH) return false;
  const actual = scrypt(password, salt, N, r, p);
  return timingSafeEqual(actual, expected);
}

export interface AdminAccount {
  email: string;
  passwordHash: string;
}

/** Constant-time-ish check of email + password (always runs scrypt). */
export function checkCredentials(account: AdminAccount, email: unknown, password: unknown): boolean {
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 1024) {
    verifyPassword('x', account.passwordHash);
    return false;
  }
  const passwordOk = verifyPassword(password, account.passwordHash);
  const emailOk = email.trim().toLowerCase() === account.email.toLowerCase();
  return passwordOk && emailOk;
}

/** Server-side sessions (in memory): revocable, and a restart simply logs everyone out. */
export class SessionStore {
  private readonly sessions = new Map<string, { email: string; expires: number }>();
  private readonly ttlMs: number;

  constructor(ttlMs = 8 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  create(email: string, now = Date.now()): string {
    const id = randomBytes(32).toString('base64url');
    this.sessions.set(id, { email, expires: now + this.ttlMs });
    return id;
  }

  get(id: string | undefined, now = Date.now()): { email: string } | null {
    if (!id) return null;
    const s = this.sessions.get(id);
    if (!s) return null;
    if (s.expires < now) {
      this.sessions.delete(id);
      return null;
    }
    return { email: s.email };
  }

  destroy(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }
}

/** Failed-login limiter: per client and overall, in a sliding window. */
export class LoginLimiter {
  private readonly failures = new Map<string, number[]>();
  private readonly perClient: number;
  private readonly total: number;
  private readonly windowMs: number;

  constructor(perClient = 5, total = 50, windowMs = 15 * 60 * 1000) {
    this.perClient = perClient;
    this.total = total;
    this.windowMs = windowMs;
  }

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.failures.set(key, list);
    return list;
  }

  blocked(client: string, now = Date.now()): boolean {
    return this.recent(client, now).length >= this.perClient || this.recent('*', now).length >= this.total;
  }

  fail(client: string, now = Date.now()): void {
    this.recent(client, now).push(now);
    this.recent('*', now).push(now);
  }

  reset(client: string): void {
    this.failures.delete(client);
  }
}
