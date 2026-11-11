import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SiteHeaderComponent } from './sections/site-header/site-header.component';
import { HeroComponent } from './sections/hero/hero.component';
import { AboutComponent } from './sections/about/about.component';
import { PhilosophyComponent } from './sections/philosophy/philosophy.component';
import { ProductsComponent } from './sections/products/products.component';
import { AngusComponent } from './sections/angus/angus.component';
import { TeamComponent } from './sections/team/team.component';
import { RegionComponent } from './sections/region/region.component';
import { GalleryComponent } from './sections/gallery/gallery.component';
import { ContactComponent } from './sections/contact/contact.component';
import { SiteFooterComponent } from './sections/site-footer/site-footer.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SiteHeaderComponent,
    HeroComponent,
    AboutComponent,
    PhilosophyComponent,
    ProductsComponent,
    AngusComponent,
    TeamComponent,
    RegionComponent,
    GalleryComponent,
    ContactComponent,
    SiteFooterComponent,
  ],
  template: `
    <div class="header-slot">
      <app-site-header />
    </div>
    <main>
      <app-hero />
      <app-about />
      <app-philosophy />
      <app-products />
      <app-angus />
      <app-team />
      <app-region />
      <app-gallery />
      <app-contact />
    </main>
    <app-site-footer />
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--font-text);
      color: var(--color-ink);
      background: var(--color-cream);
    }
    .header-slot {
      position: sticky;
      top: 0;
      z-index: 20;
    }
  `,
})
export class App {}
