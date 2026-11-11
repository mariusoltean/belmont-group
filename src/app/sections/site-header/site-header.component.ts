import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService, LOCALES, Locale } from '../../core/i18n.service';
import { ScrollProgressService, TRACKED_SECTIONS } from '../../core/scroll-progress.service';
import { TranslatePipe } from '../../core/t.pipe';

const LANGUAGE_NAMES: Record<Locale, string> = { ro: 'Română', en: 'English' };

@Component({
  selector: 'app-site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
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

  protected pick(code: Locale): void {
    void this.i18n.setLocale(code);
  }
}
