import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Breadcrumbs, CtaBand, SitePage } from '~/components/site/SiteLayout'
import { PLATFORMS, SPEC_REVIEWED, STORES, platformsForStore } from '~/lib/model/platforms'
import { absoluteUrl, jsonLd, seo } from '~/lib/site'

export const Route = createFileRoute('/screenshot-sizes/')({
  head: () => ({
    ...seo({
      title: 'Store screenshot sizes 2026: App Store, Google Play, Microsoft Store, Steam & TV — Storedeck',
      description: `Every screenshot size for ${PLATFORMS.length} platforms across the App Store, Google Play, Microsoft Store, Steam, Amazon Appstore and TV stores — in one table, checked ${SPEC_REVIEWED}.`,
      path: '/screenshot-sizes',
    }),
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Store screenshot sizes',
        url: absoluteUrl('/screenshot-sizes'),
        dateModified: SPEC_REVIEWED,
        hasPart: STORES.map(s => ({ '@type': 'WebPage', name: `${s.name} screenshot sizes`, url: absoluteUrl(`/screenshot-sizes/${s.slug}`) })),
      }),
    ],
  }),
  component: SizesIndex,
})

function SizesIndex() {
  return (
    <SitePage>
      <div className="mx-auto max-w-6xl px-5 pt-10 pb-4">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Screenshot sizes' }]} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">Store screenshot sizes</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-7 text-zinc-600">
          The recommended size for every platform, with links to full requirements. Checked against official store documentation on{' '}
          <time dateTime={SPEC_REVIEWED}>{new Date(SPEC_REVIEWED).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>.
        </p>
      </div>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8">
        {STORES.map(store => (
          <section key={store.id}>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">{store.name}</h2>
              <Link to="/screenshot-sizes/$store" params={{ store: store.slug }} className="inline-flex items-center gap-1 text-[14px] font-medium text-brand-700 hover:gap-2">
                All {store.name} sizes <ArrowRight size={14} />
              </Link>
            </div>
            <p className="mt-1 text-[15px] text-zinc-600">{store.tagline}</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-zinc-50 text-zinc-900">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Platform</th>
                    <th className="px-4 py-2.5 font-semibold">Recommended size</th>
                    <th className="px-4 py-2.5 font-semibold">Other sizes</th>
                    <th className="px-4 py-2.5 font-semibold">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {platformsForStore(store.id).map(p => {
                    const main = p.sizes.find(s => s.id === p.defaultSizeId) ?? p.sizes[0]
                    return (
                      <tr key={p.id} className="border-t border-zinc-100">
                        <td className="px-4 py-2.5 font-medium text-zinc-900">{p.name}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {main.width} × {main.height}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600 tabular-nums">
                          {p.sizes.filter(s => s !== main).map(s => `${s.width}×${s.height}`).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {p.screenshots.min}
                          {p.screenshots.max ? `–${p.screenshots.max}` : '+'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <CtaBand title="Every size is a preset in the editor" text="Pick a platform and Storedeck sets the exact canvas, count limits and a fitting device frame." />
    </SitePage>
  )
}
