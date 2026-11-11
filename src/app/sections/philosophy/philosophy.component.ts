import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

@Component({
  selector: 'app-philosophy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './philosophy.component.html',
  styleUrl: './philosophy.component.scss',
})
export class PhilosophyComponent {}
