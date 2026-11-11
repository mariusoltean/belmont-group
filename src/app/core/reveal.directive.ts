import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Fades a section's inner container in once, when it first scrolls into view.
 * Content starts visible and is only hidden when it sits below 90 % of the viewport,
 * motion is allowed and IntersectionObserver exists — so it can never stay hidden.
 * Never put this on an ancestor of a `position: fixed` element (the gallery lightbox).
 */
@Directive({ selector: '[appReveal]' })
export class RevealDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => this.setup());
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  private setup(): void {
    const win = this.document.defaultView;
    if (!win || typeof win.IntersectionObserver !== 'function') return;
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const el = this.el.nativeElement;
    if (el.getBoundingClientRect().top < win.innerHeight * 0.9) return;

    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';

    this.observer = new win.IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0px)';
          this.observer?.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    this.observer.observe(el);
  }
}
