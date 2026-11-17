import galleryData from '../../../content/gallery.json';
import imageData from '../../../content/images.json';
import type { Locale } from './i18n.service';

/**
 * Editable content (managed from /admin, stored in `content/`). The site is rebuilt
 * on every publish, so it is bundled at build time.
 */
export interface ContentImage {
  /** Path served by the site, e.g. `images/farm/cows.jpg` or `uploads/ab12.jpg` (max ~1600px). */
  file: string;
  width: number;
  height: number;
}

export interface GalleryEntry extends ContentImage {
  caption: Record<Locale, string>;
}

export type ImageSlot = 'hero' | 'angus' | 'romania' | 'transylvania';

export const GALLERY: readonly GalleryEntry[] = galleryData;
export const IMAGES: Readonly<Record<ImageSlot, ContentImage>> = imageData;

/** 800px copy of a photo: same name in a `w800/` folder next to it. */
export function thumbnailOf(file: string): string {
  const slash = file.lastIndexOf('/');
  return file.slice(0, slash + 1) + 'w800/' + file.slice(slash + 1);
}

/** `srcset` with the 800px copy and the full image. */
export function srcsetOf(image: ContentImage): string {
  return `${thumbnailOf(image.file)} 800w, ${image.file} ${image.width}w`;
}
