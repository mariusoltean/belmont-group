import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';
import { toTelHref } from '../../core/phone';

interface Member {
  area: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

/** Photos, bios and the owner's name are open items: placeholders stay visibly marked. */
@Component({
  selector: 'app-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
})
export class TeamComponent {
  private readonly i18n = inject(I18nService);

  protected readonly members = computed(() => this.i18n.list<Member>('team.members'));
  protected readonly telHref = toTelHref;
}
