import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

interface Entry {
  title: string;
  text: string;
}

@Component({
  selector: 'app-angus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './angus.component.html',
  styleUrl: './angus.component.scss',
})
export class AngusComponent {
  private readonly i18n = inject(I18nService);

  protected readonly traits = computed(() => this.i18n.list<Entry>('angus.traits'));
  protected readonly benefits = computed(() => this.i18n.list<Entry>('angus.benefits'));
}
