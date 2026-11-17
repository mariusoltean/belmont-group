/** sitemap.xml for the single page, listing every photo (image sitemap). */
export interface SitemapImage {
  file: string;
}

export const SITE_URL = 'https://belmont-group.ro';

export function buildSitemap(images: readonly SitemapImage[], lastmod: Date = new Date()): string {
  const seen = new Set<string>();
  const entries = images
    .filter((img) => (seen.has(img.file) ? false : (seen.add(img.file), true)))
    .map((img) => `\n    <image:image>\n      <image:loc>${SITE_URL}/${escapeXml(img.file)}</image:loc>\n    </image:image>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>${entries}
  </url>
</urlset>
`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
