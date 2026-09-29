// Structured content for guides and FAQ. Plain data (no JSX) so the same
// source renders pages, JSON-LD, the sitemap and llms.txt.
// Inline text supports **bold**, `code` and [links](/path).

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string; id?: string }
  | { t: 'h3'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'callout'; tone?: 'tip' | 'note' | 'warn'; text: string }
  | { t: 'code'; lang?: string; code: string }
  /** Live size table from the platform catalog, so guides never drift from the editor. */
  | { t: 'sizes'; platformIds: string[] }

export interface Faq {
  q: string
  a: string
}

export interface Guide {
  slug: string
  title: string
  /** Meta description (≤ 160 chars). */
  description: string
  category: 'Store requirements' | 'Strategy' | 'Localization' | 'Automation'
  updated: string
  readMinutes: number
  /** Key takeaways shown at the top. */
  summary: string[]
  blocks: Block[]
  faqs?: Faq[]
  related?: string[]
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Strips inline markup for meta tags, JSON-LD and llms.txt. */
export function plain(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[(.+?)\]\((.+?)\)/g, '$1')
}
