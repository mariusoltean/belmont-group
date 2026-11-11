import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import ro from '../../../../public/i18n/ro.json';
import en from '../../../../public/i18n/en.json';
import { I18nService } from '../../core/i18n.service';
import { GalleryComponent } from './gallery.component';

describe('GalleryComponent', () => {
  let fixture: ComponentFixture<GalleryComponent>;
  let el: HTMLElement;
  let i18n: I18nService;
  let http: HttpTestingController;

  const thumbs = () => el.querySelectorAll<HTMLButtonElement>('.thumb');
  const moreButton = () => el.querySelector<HTMLButtonElement>('.more-btn');
  const status = () => el.querySelector('[role="status"]')!.textContent!.trim();
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const key = async (k: string, shiftKey = false) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    i18n = TestBed.inject(I18nService);
    http = TestBed.inject(HttpTestingController);
    const init = i18n.init();
    http.expectOne('i18n/ro.json').flush(ro);
    await init;

    fixture = TestBed.createComponent(GalleryComponent);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  it('shows 8 photos, then 4 more per click up to 16, then hides the button', async () => {
    expect(thumbs().length).toBe(8);
    expect(status()).toBe('8 din 16 fotografii');

    moreButton()!.click();
    await fixture.whenStable();
    expect(thumbs().length).toBe(12);
    expect(status()).toBe('12 din 16 fotografii');

    moreButton()!.click();
    await fixture.whenStable();
    expect(thumbs().length).toBe(16);
    expect(moreButton()).toBeNull();
  });

  it('honours the initialCount and pageSize inputs', async () => {
    fixture.componentRef.setInput('initialCount', 4);
    fixture.componentRef.setInput('pageSize', 6);
    await fixture.whenStable();
    expect(thumbs().length).toBe(4);
    moreButton()!.click();
    await fixture.whenStable();
    expect(thumbs().length).toBe(10);
  });

  it('labels thumbnails with translated captions and follows the locale', async () => {
    expect(thumbs()[0].getAttribute('aria-label')).toBe('Mărește fotografia: Cireada Belmont Angus');
    const switching = i18n.setLocale('en');
    http.expectOne('i18n/en.json').flush(en);
    await switching;
    await fixture.whenStable();
    expect(thumbs()[0].getAttribute('aria-label')).toBe(`${en.gallery.open}: ${en.gallery.photos[0]}`);
    expect(status()).toBe(`8 ${en.gallery.countOf} 16 ${en.gallery.countUnit}`);
  });

  it('opens a lightbox that moves focus in, locks scroll and wraps prev/next', async () => {
    thumbs()[0].focus();
    thumbs()[0].click();
    await fixture.whenStable();

    const box = dialog()!;
    expect(box).not.toBeNull();
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(box.querySelector('.close'));
    expect(document.body.style.overflow).toBe('hidden');
    expect(box.textContent).toContain('1 / 8');

    await key('ArrowLeft');
    expect(dialog()!.textContent).toContain('8 / 8');
    await key('ArrowRight');
    expect(dialog()!.textContent).toContain('1 / 8');
    await key('ArrowRight');
    expect(dialog()!.textContent).toContain('2 / 8');
    expect(dialog()!.querySelector('img')!.getAttribute('alt')).toBe(ro.gallery.photos[1]);
  });

  it('closes on Escape, unlocks scroll and returns focus to the thumbnail', async () => {
    const trigger = thumbs()[2];
    trigger.click();
    await fixture.whenStable();
    await key('Escape');
    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('traps focus inside the dialog', async () => {
    thumbs()[0].click();
    await fixture.whenStable();
    const buttons = dialog()!.querySelectorAll<HTMLButtonElement>('button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    last.focus();
    await key('Tab');
    expect(document.activeElement).toBe(first);

    first.focus();
    await key('Tab', true);
    expect(document.activeElement).toBe(last);
  });
});
