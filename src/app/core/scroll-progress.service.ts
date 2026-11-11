import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';

/** Sections the header nav tracks, in page order. */
export const TRACKED_SECTIONS = ['about', 'philosophy', 'products', 'angus', 'gallery'] as const;

/** Percentage scrolled, 0–100 with one decimal. */
export function scrollPercent(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const max = scrollHeight - viewportHeight;
  if (max <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, scrollY / max)) * 1000) / 10;
}

@Injectable({ providedIn: 'root' })
export class ScrollProgressService {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  readonly progress = signal(0);
  readonly compact = signal(false);
  readonly activeSection = signal('');

  private ticking = false;

  constructor() {
    const win = this.document.defaultView;
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || !win) return;

    const onScroll = () => {
      if (this.ticking) return;
      this.ticking = true;
      win.requestAnimationFrame(() => {
        this.ticking = false;
        this.measure();
      });
    };

    this.zone.runOutsideAngular(() => {
      win.addEventListener('scroll', onScroll, { passive: true });
      win.addEventListener('resize', onScroll, { passive: true });
    });
    onScroll();

    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('scroll', onScroll);
      win.removeEventListener('resize', onScroll);
    });
  }

  /** Reads the scroll position and updates the signals. Public for tests. */
  measure(): void {
    const win = this.document.defaultView;
    if (!win) return;
    const doc = this.document.scrollingElement ?? this.document.documentElement;
    const y = win.scrollY || doc.scrollTop || 0;

    let active = '';
    for (const id of TRACKED_SECTIONS) {
      const el = this.document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 160) active = id;
    }

    this.progress.set(scrollPercent(y, doc.scrollHeight, win.innerHeight));
    this.compact.set(y > 24);
    this.activeSection.set(active);
  }
}
