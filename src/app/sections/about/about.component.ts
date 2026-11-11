import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  /** Village names are proper nouns, identical in both languages (as in the design). */
  protected readonly farms = ['Glâmboaca', 'Colun', 'Săsăuș'];
}
