import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService, LOCALE_STORAGE_KEY, resolveKey } from './i18n.service';
import { TranslatePipe } from './t.pipe';

const RO = {
  meta: { title: 'Titlu RO', description: 'Descriere RO' },
  hero: { title: 'Angus RO', facts: [{ title: 'a', text: 'b' }] },
  region: { romania: { kicker: 'România' } },
};
const EN = {
  meta: { title: 'Title EN', description: 'Description EN' },
  hero: { title: 'Angus EN', facts: [{ title: 'c', text: 'd' }] },
  region: { romania: { kicker: 'Romania' } },
};

function setup() {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
  });
  return {
    service: TestBed.inject(I18nService),
    http: TestBed.inject(HttpTestingController),
  };
}

async function flushInit(service: I18nService, http: HttpTestingController, locale: 'ro' | 'en' = 'ro') {
  const done = service.init();
  http.expectOne(`i18n/${locale}.json`).flush(locale === 'ro' ? RO : EN);
  await done;
}

describe('resolveKey', () => {
  it('resolves dotted keys and returns undefined for missing paths', () => {
    expect(resolveKey(RO, 'region.romania.kicker')).toBe('România');
    expect(resolveKey(RO, 'hero.missing.deep')).toBeUndefined();
    expect(resolveKey(undefined, 'hero')).toBeUndefined();
  });
});

describe('I18nService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('defaults to Romanian and resolves strings, lists and missing keys', async () => {
    const { service, http } = setup();
    await flushInit(service, http);

    expect(service.locale()).toBe('ro');
    expect(service.text('hero.title')).toBe('Angus RO');
    expect(service.list('hero.facts')).toEqual([{ title: 'a', text: 'b' }]);
    expect(service.translate('hero.facts')).toBe(RO.hero.facts);
    expect(service.text('hero.nope')).toBe('hero.nope');
    expect(service.list('hero.title')).toEqual([]);
  });

  it('switches locale, persists it and updates lang, title and description', async () => {
    const { service, http } = setup();
    await flushInit(service, http);

    const switching = service.setLocale('en');
    http.expectOne('i18n/en.json').flush(EN);
    await switching;

    expect(service.text('hero.title')).toBe('Angus EN');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(TestBed.inject(Title).getTitle()).toBe('Title EN');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('Description EN');
  });

  it('keeps both dictionaries cached after the first load', async () => {
    const { service, http } = setup();
    await flushInit(service, http);
    const switching = service.setLocale('en');
    http.expectOne('i18n/en.json').flush(EN);
    await switching;

    await service.setLocale('ro');
    await service.setLocale('en');
    http.expectNone('i18n/ro.json');
    http.expectNone('i18n/en.json');
    expect(service.text('hero.title')).toBe('Angus EN');
  });

  it('restores a stored choice and ignores invalid stored values', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const first = setup();
    await flushInit(first.service, first.http, 'en');
    expect(first.service.locale()).toBe('en');

    TestBed.resetTestingModule();
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de');
    const second = setup();
    await flushInit(second.service, second.http, 'ro');
    expect(second.service.locale()).toBe('ro');
  });

  it('falls back to Romanian when the stored dictionary fails to load', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const { service, http } = setup();
    const done = service.init();
    http.expectOne('i18n/en.json').flush('nope', { status: 500, statusText: 'Server Error' });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));
    http.expectOne('i18n/ro.json').flush(RO);
    await done;
    expect(service.locale()).toBe('ro');
  });
});

@Component({
  imports: [TranslatePipe],
  template: `<p>{{ 'hero.title' | t }}</p>`,
})
class PipeHost {}

describe('TranslatePipe', () => {
  beforeEach(() => localStorage.clear());

  it('re-renders when the locale changes', async () => {
    const { service, http } = setup();
    await flushInit(service, http);
    const fixture = TestBed.createComponent(PipeHost);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Angus RO');

    const switching = service.setLocale('en');
    http.expectOne('i18n/en.json').flush(EN);
    await switching;
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Angus EN');
  });
});
