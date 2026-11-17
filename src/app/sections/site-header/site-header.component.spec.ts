import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import ro from '../../../../content/i18n/ro.json';
import { I18nService } from '../../core/i18n.service';
import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent mobile menu', () => {
  async function render() {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    const init = TestBed.inject(I18nService).init();
    TestBed.inject(HttpTestingController).expectOne('i18n/ro.json').flush(ro);
    await init;
    const fixture = TestBed.createComponent(SiteHeaderComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('opens and closes from the button, a link and Escape', async () => {
    const { fixture, el } = await render();
    const button = el.querySelector<HTMLButtonElement>('.menu-btn')!;
    const nav = el.querySelector('#site-nav')!;
    expect(button.getAttribute('aria-controls')).toBe('site-nav');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(ro.header.menuOpen);

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe(ro.header.menuClose);
    expect(nav.classList).toContain('is-open');

    el.querySelector<HTMLAnchorElement>('.nav a[href="#team"]')!.click();
    await fixture.whenStable();
    expect(nav.classList).not.toContain('is-open');

    button.click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('links to the team section in the nav', async () => {
    const { el } = await render();
    const labels = [...el.querySelectorAll('.nav-link')].map((a) => a.getAttribute('href'));
    expect(labels).toContain('#team');
  });
});
