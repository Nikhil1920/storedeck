import { createFileRoute } from '@tanstack/react-router'
import { Inline } from '~/components/site/Prose'
import { Breadcrumbs, CtaBand, SitePage } from '~/components/site/SiteLayout'
import { ALL_FAQ, FAQ } from '~/content/faq'
import { plain, slugify } from '~/content/types'
import { jsonLd, seo } from '~/lib/site'

export const Route = createFileRoute('/faq')({
  head: () => ({
    ...seo({
      title: 'FAQ — Storedeck store screenshot generator',
      description: 'Answers about Storedeck: supported stores and sizes, privacy, localization, A/B variants, exports and controlling the editor with AI agents over WebMCP.',
      path: '/faq',
    }),
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: ALL_FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })),
      }),
    ],
  }),
  component: FaqPage,
})

function FaqPage() {
  return (
    <SitePage>
      <div className="mx-auto max-w-3xl px-5 pt-10 pb-4">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'FAQ' }]} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">Frequently asked questions</h1>
      </div>
      <div className="mx-auto max-w-3xl space-y-12 px-5 py-8">
        {FAQ.map(section => (
          <section key={section.title} aria-labelledby={slugify(section.title)}>
            <h2 id={slugify(section.title)} className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
              {section.title}
            </h2>
            <dl className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
              {section.items.map(f => (
                <div key={f.q} className="py-5">
                  <dt className="text-[17px] font-semibold text-zinc-950">{f.q}</dt>
                  <dd className="prose-sd mt-2 text-[16px] leading-7">
                    <Inline text={f.a} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <CtaBand />
    </SitePage>
  )
}
