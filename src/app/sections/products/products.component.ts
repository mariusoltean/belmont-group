import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

interface Product {
  title: string;
  text: string;
}

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly items = computed(() =>
    this.i18n.list<Product>('products.items').map((it, i) => ({ no: '0' + (i + 1), ...it })),
  );
}
