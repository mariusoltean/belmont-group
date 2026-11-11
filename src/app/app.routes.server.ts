import { RenderMode, ServerRoute } from '@angular/ssr';

/** Single page, prerendered at build time so crawlers get the full Romanian content. */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Prerender }];
