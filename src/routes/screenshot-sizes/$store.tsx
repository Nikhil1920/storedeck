import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { SizesTable } from '~/components/site/Prose'
import { Breadcrumbs, CtaBand, SitePage } from '~/components/site/SiteLayout'
import { GUIDES } from '~/content/guides'
import { SPEC_REVIEWED, STORES, platformsForStore, type PlatformSpec, type StoreSpec } from '~/lib/model/platforms'
import { SITE, absoluteUrl, jsonLd, seo } from '~/lib/site'

function findStore(slug: string): StoreSpec | undefined {
  return STORES.find(s => s.slug === slug)
}

function sizeFaq(p: PlatformSpec) {
  const main = p.sizes.find(s => s.id === p.defaultSizeId) ?? p.sizes[0]
  const all = p.sizes.map(s => `${s.width} × ${s.height}`).join(', ')
  return {
    q: `What size are ${p.name} screenshots${p.store === 'web' ? '' : ` for the ${findStore(p.store)?.name ?? p.store}`}?`,
    a: `Use ${main.width} × ${main.height}${p.sizes.length > 1 ? ` (accepted: ${all})` : ''}${p.rotatable ? '; the rotated orientation is accepted too' : ''}. ${p.formats}. ${p.screenshots.max ? `Upload ${p.screenshots.min} to ${p.screenshots.max} screenshots.` : `Upload at least ${p.screenshots.min}.`}`,
  }
}

const STORE_GUIDE: Record<string, string> = {
  'app-store': 'app-store-screenshot-sizes',
  'google-play': 'google-play-screenshot-requirements',
  'microsoft-store': 'desktop-app-store-screenshots',
  steam: 'desktop-app-store-screenshots',
  'amazon-appstore': 'tv-app-store-screenshots',
  'tv-stores': 'tv-app-store-screenshots',
  web: 'screenshot-copywriting',
}

export const Route = createFileRoute('/screenshot-sizes/$store')({
  loader: ({ params }) => {
    if (!findStore(params.store)) throw notFound()
    return { store: params.store }
  },
  head: ({ params }) => {
    const store = findStore(params.store)
    if (!store) return { meta: [{ title: 'Not found — Storedeck' }, { name: 'robots', content: 'noindex' }] }
    const platforms = platformsForStore(store.id)
    const url = absoluteUrl(`/screenshot-sizes/${store.slug}`)
    const title = store.id === 'web' ? 'Social & web image sizes for app launches' : `${store.name} screenshot sizes & requirements (2026)`
    return {
      ...seo({
        title: `${title} — Storedeck`,
        description: `${store.name} screenshot sizes for ${platforms.map(p => p.name).join(', ')}: exact pixels, formats and limits, checked ${SPEC_REVIEWED}.`.slice(0, 300),
        path: `/screenshot-sizes/${store.slug}`,
        type: 'article',
      }),
      scripts: [
        jsonLd({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'TechArticle', headline: title, url, dateModified: SPEC_REVIEWED, author: { '@type': 'Organization', name: SITE.name }, isBasedOn: store.sourceUrl },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
                { '@type': 'ListItem', position: 2, name: 'Screenshot sizes', item: absoluteUrl('/screenshot-sizes') },
                { '@type': 'ListItem', position: 3, name: store.name, item: url },
              ],
            },
            { '@type': 'FAQPage', mainEntity: platforms.map(sizeFaq).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
          ],
        }),
      ],
    }
  },
  component: StorePage,
})

function StorePage() {
  const { store: slug } = Route.useLoaderData()
  const store = findStore(slug)!
  const platforms = platformsForStore(store.id)
  const guide = GUIDES.find(g => g.slug === STORE_GUIDE[store.id])
  return (
    <SitePage>
      <div className="mx-auto max-w-5xl px-5 pt-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Screenshot sizes', to: '/screenshot-sizes' }, { label: store.name }]} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">{store.id === 'web' ? 'Social & web image sizes' : `${store.name} screenshot sizes`}</h1>
        <p className="mt-3 max-w-3xl text-[17px] leading-7 text-zinc-600">{store.tagline}</p>
        <p className="mt-2 text-[13px] text-zinc-500">
          Source:{' '}
          <a href={store.sourceUrl} className="inline-flex items-center gap-1 underline decoration-zinc-300 hover:text-zinc-900" rel="noopener" target="_blank">
            official documentation <ExternalLink size={12} />
          </a>{' '}
          · checked <time dateTime={SPEC_REVIEWED}>{SPEC_REVIEWED}</time>
        </p>
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Platforms">
          {platforms.map(p => (
            <a key={p.id} href={`#${p.id}`} className="rounded-full border border-zinc-200 px-3 py-1 text-[13px] text-zinc-700 hover:border-brand-300">
              {p.name}
            </a>
          ))}
        </nav>
      </div>
      <div className="prose-sd mx-auto max-w-5xl px-5 pb-6">
        {platforms.map(p => {
          const faq = sizeFaq(p)
          return (
            <section key={p.id} id={p.id} className="scroll-mt-24">
              <h2>{p.name}</h2>
              <SizesTable platformIds={[p.id]} />
              <ul>
                <li>
                  <strong>Format:</strong> {p.formats}
                </li>
                <li>
                  <strong>How many:</strong> {p.screenshots.max ? `${p.screenshots.min} to ${p.screenshots.max}` : `at least ${p.screenshots.min}`}
                </li>
                {p.requirements.map(r => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p>
                <Link to="/editor" search={{ platform: p.id }}>
                  Design {p.name} screenshots in Storedeck →
                </Link>
              </p>
              <h3>{faq.q}</h3>
              <p>{faq.a}</p>
            </section>
          )
        })}
      </div>
      {guide && (
        <div className="mx-auto max-w-5xl px-5">
          <Link to="/guides/$slug" params={{ slug: guide.slug }} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 p-5 hover:border-brand-300">
            <span>
              <span className="block text-[12px] font-semibold uppercase tracking-wide text-brand-700">Guide</span>
              <span className="mt-1 block text-[17px] font-semibold text-zinc-950">{guide.title}</span>
            </span>
            <ArrowRight className="shrink-0 text-brand-600" />
          </Link>
        </div>
      )}
      <nav className="mx-auto mt-8 max-w-5xl px-5 text-[14px] text-zinc-500" aria-label="Other stores">
        Other stores:{' '}
        {STORES.filter(s => s.id !== store.id).map((s, i) => (
          <span key={s.id}>
            {i > 0 && ' · '}
            <Link to="/screenshot-sizes/$store" params={{ store: s.slug }} className="hover:text-zinc-900">
              {s.name}
            </Link>
          </span>
        ))}
      </nav>
      <CtaBand />
    </SitePage>
  )
}
