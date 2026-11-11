import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollProgressService, scrollPercent } from './scroll-progress.service';

describe('scrollPercent', () => {
  it('returns 0–100 with one decimal and clamps', () => {
    expect(scrollPercent(0, 2000, 1000)).toBe(0);
    expect(scrollPercent(500, 2000, 1000)).toBe(50);
    expect(scrollPercent(333, 2000, 1000)).toBe(33.3);
    expect(scrollPercent(5000, 2000, 1000)).toBe(100);
    expect(scrollPercent(-10, 2000, 1000)).toBe(0);
    expect(scrollPercent(100, 800, 1000)).toBe(0);
  });
});

describe('ScrollProgressService', () => {
  const sections: HTMLElement[] = [];

  function addSection(id: string, top: number) {
    const el = document.createElement('section');
    el.id = id;
    el.getBoundingClientRect = () => ({ top }) as DOMRect;
    document.body.appendChild(el);
    sections.push(el);
  }

  function setScrollY(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    sections.splice(0).forEach((el) => el.remove());
    setScrollY(0);
  });

  it('is not compact and has no active section at the top', () => {
    addSection('about', 600);
    setScrollY(0);
    const service = TestBed.inject(ScrollProgressService);
    service.measure();
    expect(service.compact()).toBe(false);
    expect(service.activeSection()).toBe('');
    expect(service.progress()).toBe(0);
  });

  it('compacts past 24px and picks the last section within 160px of the top', () => {
    addSection('about', -400);
    addSection('philosophy', 120);
    addSection('products', 161);
    setScrollY(800);
    const service = TestBed.inject(ScrollProgressService);
    service.measure();
    expect(service.compact()).toBe(true);
    expect(service.activeSection()).toBe('philosophy');
  });

  it('updates after a scroll event (rAF-throttled)', async () => {
    addSection('about', 100);
    const service = TestBed.inject(ScrollProgressService);
    setScrollY(30);
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 20));
    expect(service.compact()).toBe(true);
    expect(service.activeSection()).toBe('about');
  });
});
