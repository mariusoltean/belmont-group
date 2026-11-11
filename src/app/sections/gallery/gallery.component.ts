import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import galleryData from '../../data/gallery.json';
import { I18nService } from '../../core/i18n.service';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

export interface GalleryEntry {
  /** Path under `public/`, e.g. `images/photo-01.jpg`. */
  file: string;
  /** Index into the `gallery.photos` captions. */
  captionIndex: number;
}

export const GALLERY: readonly GalleryEntry[] = galleryData;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

@Component({
  selector: 'app-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class GalleryComponent {
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Photos shown before "load more" is used. */
  readonly initialCount = input(8, { transform: numberAttribute });
  /** Photos added per "load more" click. */
  readonly pageSize = input(4, { transform: numberAttribute });

  protected readonly total = GALLERY.length;

  /** Number of thumbnails currently rendered; resets when `initialCount` changes. */
  readonly shown = linkedSignal(() => clamp(this.initialCount() || 8, 1, this.total));
  /** Index of the photo open in the lightbox, or -1. */
  readonly openIndex = signal(-1);

  private readonly captions = computed(() => this.i18n.list<string>('gallery.photos'));

  readonly photos = computed(() => {
    const captions = this.captions();
    const openLabel = this.i18n.text('gallery.open');
    return GALLERY.slice(0, this.shown()).map((entry) => {
      const caption = captions[entry.captionIndex] ?? '';
      return {
        src: entry.file,
        thumb: entry.file.replace('images/', 'images/w800/'),
        medium: entry.file.replace('images/', 'images/w1200/'),
        caption,
        openLabel: `${openLabel}: ${caption}`,
      };
    });
  });

  readonly hasMore = computed(() => this.shown() < this.total);

  readonly countLabel = computed(
    () =>
      `${this.shown()} ${this.i18n.text('gallery.countOf')} ${this.total} ${this.i18n.text('gallery.countUnit')}`,
  );

  readonly isOpen = computed(() => this.openIndex() >= 0 && this.openIndex() < this.shown());

  readonly current = computed(() => {
    const at = this.isOpen() ? this.openIndex() : 0;
    const photo = this.photos()[at];
    return { ...photo, count: `${at + 1} / ${this.shown()}` };
  });

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private returnFocusTo: HTMLElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unlockScroll());
  }

  loadMore(): void {
    this.shown.update((n) => Math.min(this.total, n + Math.max(1, this.pageSize() || 4)));
  }

  open(index: number, trigger?: EventTarget | null): void {
    this.returnFocusTo = trigger instanceof HTMLElement ? trigger : null;
    this.openIndex.set(index);
    this.lockScroll();
    afterNextRender(() => this.closeButton()?.nativeElement.focus(), { injector: this.injector });
  }

  close(): void {
    if (!this.isOpen()) return;
    this.openIndex.set(-1);
    this.unlockScroll();
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    target?.focus();
  }

  prev(): void {
    const n = this.shown();
    this.openIndex.update((i) => (i - 1 + n) % n);
  }

  next(): void {
    const n = this.shown();
    this.openIndex.update((i) => (i + 1) % n);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.prev();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.next();
        break;
      case 'Tab':
        this.trapFocus(event);
        break;
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const root = this.dialog()?.nativeElement;
    if (!root) return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  private lockScroll(): void {
    this.document.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    this.document.body.style.overflow = '';
  }
}
