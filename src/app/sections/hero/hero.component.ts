import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';
import { TranslatePipe } from '../../core/t.pipe';

interface Fact {
  title: string;
  text: string;
}

@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {
  private readonly i18n = inject(I18nService);

  protected readonly facts = computed(() =>
    this.i18n.list<Fact>('hero.facts').map((f, i) => ({ no: '0' + (i + 1), ...f })),
  );
}
