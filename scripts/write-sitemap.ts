// Usage: node scripts/write-sitemap.ts <site output dir>
// Writes sitemap.xml from content/gallery.json + content/images.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSitemap, type SitemapImage } from '../admin/lib/sitemap.ts';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/write-sitemap.ts <site output dir>');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const gallery = JSON.parse(readFileSync(join(root, 'content/gallery.json'), 'utf8')) as SitemapImage[];
const slots = JSON.parse(readFileSync(join(root, 'content/images.json'), 'utf8')) as Record<string, SitemapImage>;
writeFileSync(join(outDir, 'sitemap.xml'), buildSitemap([...Object.values(slots), ...gallery]));
console.log(`sitemap.xml written to ${outDir}`);
