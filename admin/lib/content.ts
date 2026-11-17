import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOCALES = ['ro', 'en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const SLOTS = ['hero', 'angus', 'romania', 'transylvania'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Image {
  file: string;
  width: number;
  height: number;
}
export interface GalleryEntry extends Image {
  caption: Record<Locale, string>;
}
export type Dictionary = { [key: string]: unknown };

export class ValidationError extends Error {}

const MAX_TEXT = 5000;
const MAX_CAPTION = 300;
const MAX_GALLERY = 500;
/** Seed images shipped with the site, or files uploaded from the admin. */
const IMAGE_PATH = /^(images\/[a-z0-9][a-z0-9/_-]*\.jpg|uploads\/[a-f0-9]{16}\.jpg)$/;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Text edits may change values only: the edited dictionary must have exactly the
 * same keys, nesting, array lengths and types as the current one (all leaves strings).
 */
export function validateDictionary(next: unknown, current: unknown, path = ''): void {
  const where = path || '(root)';
  if (typeof current === 'string') {
    if (typeof next !== 'string') throw new ValidationError(`${where}: expected text`);
    if (next.length > MAX_TEXT) throw new ValidationError(`${where}: text is too long`);
    return;
  }
  if (Array.isArray(current)) {
    if (!Array.isArray(next) || next.length !== current.length) throw new ValidationError(`${where}: list changed`);
    current.forEach((c, i) => validateDictionary(next[i], c, `${path}[${i}]`));
    return;
  }
  if (current && typeof current === 'object') {
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new ValidationError(`${where}: expected a group`);
    const a = Object.keys(current).sort().join('|');
    const b = Object.keys(next).sort().join('|');
    if (a !== b) throw new ValidationError(`${where}: keys changed`);
    for (const key of Object.keys(current)) {
      validateDictionary((next as Dictionary)[key], (current as Dictionary)[key], path ? `${path}.${key}` : key);
    }
    return;
  }
  throw new ValidationError(`${where}: unsupported value`);
}

export class ContentStore {
  readonly contentDir: string;
  readonly publicDir: string;

  constructor(contentDir: string, publicDir: string) {
    this.contentDir = contentDir;
    this.publicDir = publicDir;
  }

  private path(...parts: string[]): string {
    return join(this.contentDir, ...parts);
  }

  private readJson<T>(file: string): T {
    return JSON.parse(readFileSync(this.path(file), 'utf8')) as T;
  }

  /** Write via a temp file + rename so a crash never leaves half a JSON file. */
  private writeJson(file: string, data: unknown): void {
    const target = this.path(file);
    const tmp = `${target}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    renameSync(tmp, target);
  }

  dictionary(locale: Locale): Dictionary {
    return this.readJson<Dictionary>(`i18n/${locale}.json`);
  }

  gallery(): GalleryEntry[] {
    return this.readJson<GalleryEntry[]>('gallery.json');
  }

  images(): Record<Slot, Image> {
    return this.readJson<Record<Slot, Image>>('images.json');
  }

  saveDictionary(locale: Locale, next: unknown): void {
    validateDictionary(next, this.dictionary(locale));
    this.writeJson(`i18n/${locale}.json`, next);
  }

  saveGallery(next: unknown): GalleryEntry[] {
    if (!Array.isArray(next)) throw new ValidationError('gallery: expected a list');
    if (next.length > MAX_GALLERY) throw new ValidationError('gallery: too many photos');
    const clean = next.map((entry, i) => {
      const image = this.validateImage(entry, `gallery[${i}]`);
      const caption = (entry as { caption?: unknown }).caption;
      if (!caption || typeof caption !== 'object') throw new ValidationError(`gallery[${i}]: missing caption`);
      const c = caption as Record<string, unknown>;
      const out = {} as Record<Locale, string>;
      for (const l of LOCALES) {
        const v = c[l] ?? '';
        if (typeof v !== 'string' || v.length > MAX_CAPTION) throw new ValidationError(`gallery[${i}].caption.${l}: invalid`);
        out[l] = v.trim();
      }
      if (!out.ro) throw new ValidationError(`gallery[${i}]: the Romanian caption is required`);
      return { ...image, caption: out };
    });
    this.writeJson('gallery.json', clean);
    return clean;
  }

  saveImages(next: unknown): Record<Slot, Image> {
    if (!next || typeof next !== 'object') throw new ValidationError('images: expected a group');
    const n = next as Record<string, unknown>;
    if (Object.keys(n).sort().join('|') !== [...SLOTS].sort().join('|')) throw new ValidationError('images: wrong slots');
    const clean = {} as Record<Slot, Image>;
    for (const slot of SLOTS) clean[slot] = this.validateImage(n[slot], `images.${slot}`);
    this.writeJson('images.json', clean);
    return clean;
  }

  private validateImage(value: unknown, where: string): Image {
    if (!value || typeof value !== 'object') throw new ValidationError(`${where}: expected an image`);
    const { file, width, height } = value as Record<string, unknown>;
    if (typeof file !== 'string' || !IMAGE_PATH.test(file) || file.includes('..')) {
      throw new ValidationError(`${where}: invalid file`);
    }
    if (!this.fileExists(file)) throw new ValidationError(`${where}: file not found`);
    const ok = (v: unknown) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 10000;
    if (!ok(width) || !ok(height)) throw new ValidationError(`${where}: invalid size`);
    return { file, width: width as number, height: height as number };
  }

  /** Absolute path of a site image (seed or upload), or null if the path is not allowed. */
  resolveMedia(file: string): string | null {
    const thumb = file.replace(/\/w800\//, '/');
    if (!IMAGE_PATH.test(thumb) || file.includes('..')) return null;
    return file.startsWith('uploads/') ? this.path(file) : join(this.publicDir, file);
  }

  private fileExists(file: string): boolean {
    const slash = file.lastIndexOf('/');
    const thumb = file.slice(0, slash + 1) + 'w800/' + file.slice(slash + 1);
    const a = this.resolveMedia(file);
    const b = this.resolveMedia(thumb);
    return !!a && !!b && existsSync(a) && existsSync(b);
  }

  /** Stores an uploaded photo (full + 800px copy, both JPEG) under a random name. */
  saveUpload(full: Buffer, thumb: Buffer): Image {
    const size = jpegSize(full);
    if (!size || !jpegSize(thumb)) throw new ValidationError('upload: not a JPEG image');
    if (Math.max(size.width, size.height) > 4000) throw new ValidationError('upload: image too large');
    const id = randomBytes(8).toString('hex');
    writeFileSync(this.path('uploads', 'w800', `${id}.jpg`), thumb, { flag: 'wx' });
    writeFileSync(this.path('uploads', `${id}.jpg`), full, { flag: 'wx' });
    return { file: `uploads/${id}.jpg`, ...size };
  }

  /** Deletes uploads no longer used anywhere (older than `minAgeMs`, so fresh, unsaved uploads survive). */
  removeUnusedUploads(minAgeMs = 24 * 60 * 60 * 1000, now = Date.now()): string[] {
    const used = new Set([...this.gallery(), ...Object.values(this.images())].map((i) => i.file));
    const removed: string[] = [];
    for (const name of readdirSync(this.path('uploads'))) {
      if (!/^[a-f0-9]{16}\.jpg$/.test(name)) continue;
      const file = `uploads/${name}`;
      const full = this.path('uploads', name);
      if (used.has(file) || now - statSync(full).mtimeMs < minAgeMs) continue;
      unlinkSync(full);
      const thumb = this.path('uploads', 'w800', name);
      if (existsSync(thumb)) unlinkSync(thumb);
      removed.push(file);
    }
    return removed;
  }
}

/** Width/height from a baseline or progressive JPEG (SOF marker), or null if not a JPEG. */
export function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return width && height ? { width, height } : null;
    }
    i += 2 + length;
  }
  return null;
}
