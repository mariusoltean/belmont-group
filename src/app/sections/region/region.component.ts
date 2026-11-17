import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';
import { IMAGES, srcsetOf } from '../../core/content';

@Component({
  selector: 'app-region',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './region.component.html',
  styleUrl: './region.component.scss',
})
export class RegionComponent {
  protected readonly articles = [
    { key: 'region.romania', image: IMAGES.romania, srcset: srcsetOf(IMAGES.romania) },
    { key: 'region.transylvania', image: IMAGES.transylvania, srcset: srcsetOf(IMAGES.transylvania) },
  ];
}
