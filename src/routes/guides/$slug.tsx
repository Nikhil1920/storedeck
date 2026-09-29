import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { Blocks, Inline } from '~/components/site/Prose'
import { Breadcrumbs, CtaBand, SitePage } from '~/components/site/SiteLayout'
import { GUIDES, getGuide } from '~/content/guides'
import { plain, slugify } from '~/content/types'
import { SITE, absoluteUrl, jsonLd, seo } from '~/lib/site'

export const Route = createFileRoute('/guides/$slug')({
  loader: ({ params }) => {
    const guide = getGuide(params.slug)
    if (!guide) throw notFound()
    return { slug: guide.slug }
  },
  head: ({ params }) => {
    const g = getGuide(params.slug)
    if (!g) return { meta: [{ title: 'Guide not found — Storedeck' }, { name: 'robots', content: 'noindex' }] }
    const url = absoluteUrl(`/guides/${g.slug}`)
    const graph: unknown[] = [
      {
        '@type': 'TechArticle',
        headline: g.title,
        description: g.description,
        url,
        dateModified: g.updated,
        datePublished: g.updated,
        author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
        publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
        image: absoluteUrl(SITE.ogImage),
        mainEntityOfPage: url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
          { '@type': 'ListItem', position: 3, name: g.title, item: url },
        ],
      },
    ]
    if (g.faqs?.length) {
      graph.push({ '@type': 'FAQPage', mainEntity: g.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })) })
    }
    return {
      ...seo({ title: `${g.title} — Storedeck`, description: g.description, path: `/guides/${g.slug}`, type: 'article' }),
      scripts: [jsonLd({ '@context': 'https://schema.org', '@graph': graph })],
    }
  },
  component: GuidePage,
})

function GuidePage() {
  const { slug } = Route.useLoaderData()
  const g = getGuide(slug)!
  const toc = g.blocks.filter(b => b.t === 'h2') as Array<{ t: 'h2'; text: string; id?: string }>
  const related = (g.related ?? []).map(getGuide).filter(Boolean)
  return (
    <SitePage>
      <article className="mx-auto grid max-w-6xl gap-12 px-5 pt-10 pb-8 lg:grid-cols-[1fr_240px]">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Guides', to: '/guides' }, { label: g.title }]} />
          <p className="mt-6 text-[13px] font-semibold text-brand-700">{g.category}</p>
          <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight text-zinc-950">{g.title}</h1>
          <p className="mt-4 text-[18px] leading-8 text-zinc-600">{g.description}</p>
          <p className="mt-3 text-[13px] text-zinc-500">
            Updated <time dateTime={g.updated}>{new Date(g.updated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time> · {g.readMinutes} min read
          </p>
          <aside className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-brand-800">Key takeaways</div>
            <ul className="mt-3 space-y-2">
              {g.summary.map(s => (
                <li key={s} className="flex gap-2.5 text-[15px] leading-7 text-zinc-800">
                  <Check size={17} className="mt-1.5 shrink-0 text-brand-600" />
                  <span>
                    <Inline text={s} />
                  </span>
                </li>
              ))}
            </ul>
          </aside>
          <div className="prose-sd mt-4">
            <Blocks blocks={g.blocks} />
            {g.faqs?.length ? (
              <>
                <h2 id="faq">Frequently asked questions</h2>
                {g.faqs.map(f => (
                  <div key={f.q}>
                    <h3>{f.q}</h3>
                    <p>
                      <Inline text={f.a} />
                    </p>
                  </div>
                ))}
              </>
            ) : null}
          </div>
          {related.length > 0 && (
            <nav className="mt-14 border-t border-zinc-200 pt-8" aria-label="Related guides">
              <div className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Related guides</div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map(r => (
                  <li key={r!.slug}>
                    <Link to="/guides/$slug" params={{ slug: r!.slug }} className="flex h-full items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4 text-[15px] font-medium text-zinc-900 hover:border-brand-300">
                      {r!.title} <ArrowRight size={16} className="shrink-0 text-brand-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {toc.length > 1 && (
              <nav aria-label="On this page">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">On this page</div>
                <ul className="mt-3 space-y-2 border-l border-zinc-200 text-[14px]">
                  {toc.map(h => (
                    <li key={h.text}>
                      <a href={`#${h.id ?? slugify(h.text)}`} className="-ml-px block border-l border-transparent pl-3 text-zinc-600 hover:border-brand-500 hover:text-zinc-950">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <Link to="/editor" className="block rounded-2xl bg-zinc-950 p-5 text-white">
              <div className="text-[15px] font-semibold">Make these screenshots</div>
              <p className="mt-1 text-[13px] leading-5 text-white/70">Free editor with every size preset built in.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-200">
                Open editor <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </aside>
      </article>
      <nav className="mx-auto max-w-6xl px-5 text-[14px] text-zinc-500" aria-label="All guides">
        More guides:{' '}
        {GUIDES.filter(x => x.slug !== g.slug).map((x, i) => (
          <span key={x.slug}>
            {i > 0 && ' · '}
            <Link to="/guides/$slug" params={{ slug: x.slug }} className="hover:text-zinc-900">
              {x.title}
            </Link>
          </span>
        ))}
      </nav>
      <CtaBand />
    </SitePage>
  )
}
