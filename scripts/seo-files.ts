// Generates sitemap.xml, robots.txt, llms.txt and llms-full.txt from the same
// content modules the pages render. Loaded through Vite (see seo-plugin.ts).

import { GUIDES } from '../src/content/guides'
import * as md from '../src/content/markdown'
import { SPEC_REVIEWED, STORES } from '../src/lib/model/platforms'
import { SITE } from '../src/lib/site'

export async function buildSeoFiles(): Promise<Record<string, string>> {
  const today = new Date().toISOString().slice(0, 10)
  const pages: Array<{ path: string; lastmod: string; priority: number; changefreq: string }> = [
    { path: '/', lastmod: today, priority: 1, changefreq: 'weekly' },
    { path: '/editor', lastmod: today, priority: 0.9, changefreq: 'weekly' },
    { path: '/guides', lastmod: today, priority: 0.8, changefreq: 'weekly' },
    ...GUIDES.map(g => ({ path: `/guides/${g.slug}`, lastmod: g.updated, priority: 0.8, changefreq: 'monthly' })),
    { path: '/screenshot-sizes', lastmod: SPEC_REVIEWED, priority: 0.9, changefreq: 'monthly' },
    ...STORES.map(s => ({ path: `/screenshot-sizes/${s.slug}`, lastmod: SPEC_REVIEWED, priority: 0.8, changefreq: 'monthly' })),
    { path: '/agents', lastmod: today, priority: 0.7, changefreq: 'monthly' },
    { path: '/faq', lastmod: today, priority: 0.6, changefreq: 'monthly' },
  ]
  const urls = pages
    .map(p => `  <url>\n    <loc>${SITE.url}${p.path}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority.toFixed(1)}</priority>\n  </url>`)
    .join('\n')
  return {
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`,
    'llms.txt': md.llmsTxt(),
    'llms-full.txt': md.llmsFullTxt(),
  }
}
