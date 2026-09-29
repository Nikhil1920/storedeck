// Site-wide constants used by SEO metadata, structured data and the sitemap.

export const SITE = {
  name: 'Storedeck',
  url: 'https://storedeck.byanr.com',
  tagline: 'Store screenshots for every platform, every language, every test',
  description:
    'Free, open-source editor for App Store, Google Play, Mac, Windows, Steam and TV store screenshots — with A/B test variants, localization and full AI-agent control through WebMCP.',
  github: 'https://github.com/Nikhil1920/storedeck',
  ogImage: '/og.jpg',
} as const

export function absoluteUrl(path: string): string {
  return `${SITE.url}${path}`
}

interface SeoInput {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  image?: string
  noindex?: boolean
}

/** Title, description, canonical, Open Graph and Twitter tags for a route. */
export function seo({ title, description, path, type = 'website', image = SITE.ogImage, noindex }: SeoInput) {
  const url = absoluteUrl(path)
  const img = image.startsWith('http') ? image : absoluteUrl(image)
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: type },
      { property: 'og:url', content: url },
      { property: 'og:image', content: img },
      { property: 'og:site_name', content: SITE.name },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: img },
      ...(noindex ? [{ name: 'robots', content: 'noindex' }] : []),
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

/** JSON-LD script tag for route heads. */
export function jsonLd(data: unknown) {
  return { type: 'application/ld+json', children: JSON.stringify(data) }
}
