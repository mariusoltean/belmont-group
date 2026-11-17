import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService, LOCALES, Locale } from '../../core/i18n.service';
import { ScrollProgressService, TRACKED_SECTIONS } from '../../core/scroll-progress.service';
import { TranslatePipe } from '../../core/t.pipe';

const LANGUAGE_NAMES: Record<Locale, string> = { ro: 'Română', en: 'English', de: 'Deutsch' };

@Component({
  selector: 'app-site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: { '(document:keydown.escape)': 'closeMenu()' },
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly scroll = inject(ScrollProgressService);

  protected readonly links = computed(() => {
    const active = this.scroll.activeSection();
    return TRACKED_SECTIONS.map((id) => ({
      id,
      href: '#' + id,
      labelKey: 'header.nav.' + id,
      current: id === active,
    }));
  });

  protected readonly locales = LOCALES.map((code) => ({
    code,
    label: code.toUpperCase(),
    name: LANGUAGE_NAMES[code],
  }));

  protected readonly progressNow = computed(() => Math.round(this.scroll.progress()));

  /** Mobile menu (below the desktop breakpoint the nav collapses behind a button). */
  readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected pick(code: Locale): void {
    void this.i18n.setLocale(code);
  }
}
