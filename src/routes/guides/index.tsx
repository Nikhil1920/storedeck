import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Breadcrumbs, CtaBand, SitePage } from '~/components/site/SiteLayout'
import { GUIDES } from '~/content/guides'
import { absoluteUrl, jsonLd, seo } from '~/lib/site'

export const Route = createFileRoute('/guides/')({
  head: () => ({
    ...seo({
      title: 'Guides: App Store & Google Play screenshots, localization and A/B testing — Storedeck',
      description: 'Practical guides to store screenshot sizes, localization, A/B testing, copywriting, TV and desktop stores, and automating screenshots with AI agents.',
      path: '/guides',
    }),
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Storedeck guides',
        url: absoluteUrl('/guides'),
        hasPart: GUIDES.map(g => ({ '@type': 'TechArticle', headline: g.title, url: absoluteUrl(`/guides/${g.slug}`), dateModified: g.updated })),
      }),
    ],
  }),
  component: GuidesIndex,
})

function GuidesIndex() {
  const categories = [...new Set(GUIDES.map(g => g.category))]
  return (
    <SitePage>
      <div className="mx-auto max-w-6xl px-5 pt-10 pb-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Guides' }]} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">Store screenshot guides</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-7 text-zinc-600">Everything we learned making screenshots for app stores, TV stores and desktop stores — sizes, strategy, localization and automation.</p>
      </div>
      <div className="mx-auto max-w-6xl space-y-12 px-5 py-8">
        {categories.map(cat => (
          <section key={cat}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">{cat}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {GUIDES.filter(g => g.category === cat).map(g => (
                <Link key={g.slug} to="/guides/$slug" params={{ slug: g.slug }} className="group rounded-2xl border border-zinc-200 p-6 transition hover:border-brand-300 hover:shadow-lg hover:shadow-brand-100">
                  <h3 className="text-[19px] leading-7 font-semibold text-zinc-950">{g.title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-zinc-600">{g.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 group-hover:gap-2">
                    {g.readMinutes} min read <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <CtaBand />
    </SitePage>
  )
}
