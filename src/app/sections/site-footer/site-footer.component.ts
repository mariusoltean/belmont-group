import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/t.pipe';

@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss',
})
export class SiteFooterComponent {
  protected readonly links = ['about', 'philosophy', 'products', 'angus', 'gallery', 'contact'];
}
