import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * `{{ 'hero.title' | t }}` — reads the active dictionary. Impure so it re-evaluates
 * whenever the template refreshes; the locale signal read inside marks OnPush views dirty.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string): string {
    return this.i18n.text(key);
  }
}
