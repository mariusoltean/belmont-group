# Belmont Group website — Angular build brief

This folder is the handoff for turning the approved Belmont Group design into an Angular project. Read this file first; everything it references is in this folder.

## Goal

Build a single-page marketing site for Belmont Group (pasture-raised Angus, Transylvania) as an Angular application that reproduces the design in `design/` exactly, with Romanian as the default language and an RO / EN switch.

## What is in this folder

| Path | What it is | How to use it |
|---|---|---|
| `design/*.dc.html` | The approved design, one file per component. Source of truth for markup, inline styles, copy and behaviour. | Port each file to one Angular component. Copy numeric values exactly; do not round or restyle. |
| `i18n/ro.json`, `i18n/en.json` | All copy, extracted from the design files, namespaced by component. | Copy to `public/i18n/`. Do not retranslate or reword. |
| `styles/_tokens.scss` | Colours, type, spacing as CSS custom properties. | Import once in `src/styles.scss`; replace repeated literals with `var(--…)`. |
| `assets/images/` | `logo.png` and `photo-01.jpg` … `photo-16.jpg` (already optimised). | Copy to `public/images/`. |
| `data/gallery.json` | Gallery order: image file + index into `gallery.photos` captions. | Drives `GalleryComponent`. |
| `PROMPT.md` | A kickoff prompt to paste into Claude Code. | Optional. |

### Reading a `.dc.html` design file

- Everything inside `<x-dc>` is the template. `<helmet>` holds the font link only.
- `{{ t.title }}` is a lookup into the component's translations → `{{ 'hero.title' | t }}` (namespace = component, see table below).
- `<sc-for list="{{ items }}" as="item">` → `@for (item of items(); track $index)`.
- `<sc-if value="{{ cond }}">` → `@if (cond())`.
- `onClick="{{ fn }}"` → `(click)="fn()"`; `onSubmit` → `(ngSubmit)` / `(submit)`.
- `<dc-import name="Hero" locale="…">` in `Main.dc.html` → `<app-hero />`.
- The `<script type="text/x-dc">` block holds the logic: `i18n()` (already extracted to JSON), state, and `renderVals()` (what the template reads). Port the logic, not the class shape.
- Styles are inline in the design. Move them to each component's `.scss` with semantic class names; the rendered result must be identical.
- Image URLs were rewritten to `assets/images/…` in these copies.

## Stack and conventions

- Current stable Angular via the Angular CLI; standalone components, signals, built-in control flow (`@if`, `@for`), `ChangeDetectionStrategy.OnPush`.
- SCSS, no UI library, no CSS framework. No extra runtime dependencies unless this brief asks for them.
- Fonts: Cormorant Garamond (500, 600, italic 500) and Figtree (400–700). Self-host via `@fontsource` packages or keep the Google Fonts `<link>` from the design; both must include the `latin-ext` subset (Romanian ș, ț, ă, â, î).
- Single route. Section anchors (`#about`, `#contact` …) use native smooth scrolling; sections carry `scroll-margin-top: 100px` for the sticky header.
- Strict TypeScript. Unit tests for the services, the directive and `GalleryComponent`.

## Component map

| Design file | Angular component | Selector | i18n namespace | Notes |
|---|---|---|---|---|
| `Main.dc.html` | `AppComponent` | `app-root` | — | Composes everything; header sits in a `position: sticky; top: 0; z-index: 20` wrapper. |
| `SiteHeader.dc.html` | `SiteHeaderComponent` | `app-site-header` | `header` | Logo top-left, nav, language picker, CTA, progress bar. Interactive. |
| `Hero.dc.html` | `HeroComponent` | `app-hero` | `hero` | `id="home"`. Photo settles from scale 1.1 → 1 on load. |
| `About.dc.html` | `AboutComponent` | `app-about` | `about` | `id="about"`. |
| `Philosophy.dc.html` | `PhilosophyComponent` | `app-philosophy` | `philosophy` | `id="philosophy"`. Dark section. |
| `Products.dc.html` | `ProductsComponent` | `app-products` | `products` | `id="products"`. Numbered list from `products.items`. |
| `Angus.dc.html` | `AngusComponent` | `app-angus` | `angus` | `id="angus"`. `traits` (4) and `benefits` (6). |
| `Team.dc.html` | `TeamComponent` | `app-team` | `team` | `id="team"`. Contains marked placeholders (see Open items). |
| `Region.dc.html` | `RegionComponent` | `app-region` | `region` | `id="region"`. Two articles: `romania`, `transylvania`. |
| `Gallery.dc.html` | `GalleryComponent` | `app-gallery` | `gallery` | `id="gallery"`. Load more + lightbox. Interactive. |
| `Contact.dc.html` | `ContactComponent` | `app-contact` | `contact` | `id="contact"`. Form. Interactive. |
| `SiteFooter.dc.html` | `SiteFooterComponent` | `app-site-footer` | `footer` | Wordmark, nav, copyright. |

In the design each component receives `locale` as a prop. In Angular, do not pass it down: every component reads the shared `I18nService` instead.

## Shared pieces to build

### `I18nService` + `t` pipe

- `locale = signal<'ro' | 'en'>('ro')`. Default is always `ro`; do not auto-detect from the browser.
- Persist the choice in `localStorage` (`belmont.locale`) and restore it on start; guard for SSR / unavailable storage.
- Load `i18n/<locale>.json` over HTTP; keep both dictionaries cached after first load so switching is instant and does not reload the page.
- `translate(key)` resolves dotted keys (`hero.title`) and returns arrays/objects as-is for list keys (`hero.facts`, `products.items`, `angus.traits`, `angus.benefits`, `team.members`, `gallery.photos`).
- `t` pipe wraps `translate`; it must update when the locale signal changes.
- On every locale change set `document.documentElement.lang` and update `<title>` and the meta description (`meta.title`, `meta.description` in the JSON).

### `ScrollProgressService`

One passive `scroll` + `resize` listener on `window`, throttled with `requestAnimationFrame`, run outside Angular's zone, exposing signals:

- `progress` — 0–100, `scrollY / (scrollHeight − innerHeight)`, one decimal.
- `compact` — `scrollY > 24`.
- `activeSection` — the last of `about, philosophy, products, angus, gallery` whose top is ≤ 160 px from the viewport top; empty string above the first.

### `RevealDirective` (`appReveal`)

The design repeats the same code in seven sections; make it one directive, applied to each section's inner container (not the section root, so the background never fades).

- Initial state is visible. On init, only if the element's top is below 90 % of the viewport height, set `opacity: 0; transform: translateY(28px)`, then reveal once with `IntersectionObserver` (`threshold: 0.1`) using `transition: opacity .8s ease, transform .8s ease`, and disconnect.
- Do nothing when `prefers-reduced-motion: reduce` matches or `IntersectionObserver` is missing. Content must never stay hidden.
- Do not apply it to an ancestor of the gallery lightbox (a transformed ancestor breaks `position: fixed`).

## Behaviour spec

### Header

- Sticky at the top. Logo (`logo.png`) top-left, links to `#home`. Height 72 px, shrinking to 52 px when `compact`; vertical padding 10 px → 6 px; a soft shadow appears when `compact`. All with a 0.25 s ease transition.
- Nav links: Cine suntem, Filosofie, Produse, Rasa Angus, Galerie. The link for `activeSection` gets `color: #24382A`, a 2 px bronze underline (`box-shadow: inset 0 -2px 0 #8A5F2B`) and `aria-current="true"`.
- Language picker: two pill buttons RO / EN in a `role="group"`; the active one is filled forest green and has `aria-pressed="true"`. Each button has `lang` and an `aria-label` with the language name.
- CTA button "Contact" → `#contact`.
- Progress bar: 3 px strip along the bottom edge of the header, track `rgba(28,35,28,.12)`, fill bronze `#8A5F2B`, width = `progress` %. `role="progressbar"` with `aria-valuenow`.
- No media queries in the design: the row uses `flex-wrap`, so on narrow screens nav and controls wrap under the logo. Keep that behaviour unless asked for a burger menu.

### Hero

- Two-column `auto-fit` grid (text, square photo `photo-01.jpg`), then three numbered facts (`01`–`03`) from `hero.facts`.
- On load the photo animates `transform: scale(1.1)` → `scale(1)` over 2.4 s (`cubic-bezier(.2,.6,.2,1)`) inside an `overflow: hidden` box. Skipped for reduced motion.

### Gallery

- Data from `data/gallery.json` (16 photos, fixed order). Captions from `gallery.photos[i]` in the active language.
- Shows 8 photos initially. "Încarcă mai multe fotografii" adds 4 per click (8 → 12 → 16). A status line reads "8 din 16 fotografii" (`role="status"`). The button disappears when all are shown. Make `initialCount` (8) and `pageSize` (4) inputs.
- Grid: `repeat(auto-fill, minmax(min(260px, 100%), 1fr))`, 12 px gap, thumbnails 16:10 `object-fit: cover`, `loading="lazy"`.
- Each thumbnail is a real `<button>`; on hover and keyboard focus the image scales to 1.06 over 0.6 s.
- Lightbox: clicking a thumbnail opens a fixed full-screen dialog (`role="dialog"`, `aria-modal="true"`) with the photo, caption, "n / shown" counter, previous / next (wrapping within the photos currently shown) and close. Add what the static design could not: Escape closes, ← / → navigate, focus moves into the dialog and returns to the thumbnail on close, focus is trapped, body scroll is locked while open.

### Contact

- Fields: name, email, message — all required, email validated. Labels are visible `<label>` elements bound to inputs.
- The design shows a success line ("Mulțumim! Mesajul a fost trimis.") after submit. There is no backend yet: implement a `ContactService.send()` that is the single place to wire one in, and leave it as a clearly marked stub. Do not invent an endpoint.
- Add inline validation messages and a failure message; add the needed keys to both JSON files.

### Everything else

Static sections. Port markup and styles exactly; lists come from the JSON arrays.

## Design tokens

See `styles/_tokens.scss`. Summary: cream `#F6F1E6` (page), paper `#FBF8F1`, sage `#E9EBDF`, ink `#1C231C`, body text `#3A4438`, muted `#566052`, forest `#24382A`, deep `#141D15`, bronze `#8A5F2B` (accent on light), bronze on sage `#7A5325`, bronze-light `#D9B47A` (accent on dark), line `rgba(28,35,28,.14)`. Container `max-width: 1160px`. Section padding `clamp(52px, 5vw, 72px) clamp(20px, 5vw, 40px)`. Buttons are 2 px radius, 13 px uppercase, 0.12em tracking, 52 px tall (44 px in the header).

## Accessibility and quality bar

- One `<h1>` (hero); sections use `<h2>`, cards `<h3>`, as in the design.
- All interactive elements are real `<a>`, `<button>`, `<input>`; touch targets ≥ 44 px; visible focus styles (add a 2 px bronze focus ring — the static design has none).
- Text contrast ≥ 4.5:1 — the token colours already pass; do not lighten them.
- Decorative SVGs `aria-hidden="true"`; every photo outside the gallery grid has a translated `alt`.
- Layout is fluid from 360 px to 1440 px+ using the `auto-fit` grids, `clamp()` sizes and wrapping rows from the design; no horizontal scroll at any width.
- Images: add `width` / `height` attributes; the hero photo is eager / high priority, all others lazy. Consider `NgOptimizedImage`.
- Target Lighthouse ≥ 95 for Accessibility and Best Practices, ≥ 90 Performance on mobile.

## Open items — do not invent content for these

These are marked placeholders in the design and JSON (`[NUME]`, `[FOTO]`, `[SCURTĂ BIOGRAFIE]`, `[ADRESĂ DE E-MAIL]`, `[NUMĂR DE TELEFON — opțional]`). Keep them visibly marked until the client supplies real content:

- Owner / Managing Director name, and all three team photos and bios.
- Contact email and phone.
- Contact form backend.

Also to confirm with the client: the Romanian copy is a translation of the original English text and has not had a native review; the village spellings Glâmboaca, Colun, Săsăuș; the copyright year in the footer.

## Suggested build order

1. Scaffold the project, global styles, tokens, fonts, `public/` assets.
2. `I18nService`, `t` pipe, JSON loading, locale persistence — with tests.
3. Static sections: Hero, About, Philosophy, Products, Angus, Team, Region, Footer.
4. `ScrollProgressService` and `SiteHeaderComponent`.
5. `RevealDirective`, hero photo animation.
6. `GalleryComponent` (load more, lightbox, keyboard).
7. `ContactComponent` and `ContactService` stub.
8. Accessibility pass, responsive pass at 360 / 768 / 1024 / 1440, Lighthouse.

## Definition of done

- Side by side with the design at 1440 px, each section matches in layout, type, colour and spacing.
- Page loads in Romanian; switching to EN changes every string, `<html lang>` and the title without a reload; the choice survives a refresh.
- Progress bar tracks scroll; header compacts; the active nav link follows the section in view.
- Gallery shows 8, loads 4 more per click up to 16; lightbox works with mouse and keyboard.
- No console errors; `ng build` and `ng test` pass.
