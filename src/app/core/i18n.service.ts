import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

export type Locale = 'ro' | 'en';
export type Dictionary = { [key: string]: unknown };

export const LOCALES: readonly Locale[] = ['ro', 'en'];
export const DEFAULT_LOCALE: Locale = 'ro';
export const LOCALE_STORAGE_KEY = 'belmont.locale';

const OG_LOCALE: Record<Locale, string> = { ro: 'ro_RO', en: 'en_GB' };

export function isLocale(value: unknown): value is Locale {
  return value === 'ro' || value === 'en';
}

/** Resolves a dotted key (`hero.title`, `region.romania.p1`) in a dictionary. */
export function resolveKey(dict: Dictionary | undefined, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Dictionary)[part];
  }
  return node;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly dictionaries = signal<Partial<Record<Locale, Dictionary>>>({});
  private readonly pending = new Map<Locale, Promise<Dictionary>>();

  /** Active language. Always starts as Romanian; never auto-detected from the browser. */
  readonly locale = signal<Locale>(DEFAULT_LOCALE);

  /** Dictionary of the active language (falls back to Romanian while loading). */
  readonly dictionary = computed<Dictionary>(
    () => this.dictionaries()[this.locale()] ?? this.dictionaries()[DEFAULT_LOCALE] ?? {},
  );

  /** Loads the stored (or default) language. Used as an app initializer. */
  async init(): Promise<void> {
    const stored = this.readStoredLocale();
    try {
      await this.setLocale(stored ?? DEFAULT_LOCALE, false);
    } catch {
      if (stored && stored !== DEFAULT_LOCALE) await this.setLocale(DEFAULT_LOCALE, false);
    }
  }

  /** Switches language without reloading the page; dictionaries stay cached. */
  async setLocale(locale: Locale, persist = true): Promise<void> {
    await this.load(locale);
    this.locale.set(locale);
    if (persist) this.storeLocale(locale);
    this.applyToDocument(locale);
  }

  /** Raw lookup: strings, arrays and objects are returned as-is; `undefined` when missing. */
  translate(key: string): unknown {
    return resolveKey(this.dictionary(), key);
  }

  /** String lookup; returns the key itself when it is missing so gaps are visible. */
  text(key: string): string {
    const value = this.translate(key);
    return typeof value === 'string' ? value : key;
  }

  /** Array lookup for list keys (`hero.facts`, `gallery.photos` …). */
  list<T>(key: string): T[] {
    const value = this.translate(key);
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private load(locale: Locale): Promise<Dictionary> {
    const cached = this.dictionaries()[locale];
    if (cached) return Promise.resolve(cached);
    let request = this.pending.get(locale);
    if (!request) {
      request = firstValueFrom(this.http.get<Dictionary>(`i18n/${locale}.json`))
        .then((dict) => {
          this.dictionaries.update((all) => ({ ...all, [locale]: dict }));
          return dict;
        })
        .finally(() => this.pending.delete(locale));
      this.pending.set(locale, request);
    }
    return request;
  }

  private applyToDocument(locale: Locale): void {
    this.document.documentElement.lang = locale;
    const title = this.text('meta.title');
    const description = this.text('meta.description');
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:locale', content: OG_LOCALE[locale] });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
  }

  private readStoredLocale(): Locale | null {
    if (!this.isBrowser) return null;
    try {
      const value = this.document.defaultView?.localStorage.getItem(LOCALE_STORAGE_KEY);
      return isLocale(value) ? value : null;
    } catch {
      return null;
    }
  }

  private storeLocale(locale: Locale): void {
    if (!this.isBrowser) return;
    try {
      this.document.defaultView?.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Storage unavailable (private mode, quota): the choice just isn't remembered.
    }
  }
}
