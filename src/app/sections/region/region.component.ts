import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

@Component({
  selector: 'app-region',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './region.component.html',
  styleUrl: './region.component.scss',
})
export class RegionComponent {
  protected readonly articles = [
    { key: 'region.romania', image: 'photo-11.jpg', width: 1600, height: 1063 },
    { key: 'region.transylvania', image: 'photo-14.jpg', width: 1800, height: 1200 },
  ];
}
