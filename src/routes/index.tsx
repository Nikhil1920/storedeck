import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Bot, Boxes, Columns2, Download, FlaskConical, FolderTree, Languages, Layers3, Lock, MonitorSmartphone, ScanSearch, Sparkles } from 'lucide-react'
import { CtaBand, SiteFooter, SiteHeader } from '~/components/site/SiteLayout'
import { Inline } from '~/components/site/Prose'
import { ALL_FAQ } from '~/content/faq'
import { GUIDES } from '~/content/guides'
import { PLATFORMS, STORES, platformsForStore } from '~/lib/model/platforms'
import { TOOL_SPECS } from '~/lib/webmcp/specs'
import { SITE, absoluteUrl, jsonLd, seo } from '~/lib/site'

export const Route = createFileRoute('/')({
  head: () => ({
    ...seo({
      title: 'Storedeck — App Store & Google Play screenshot generator with A/B variants and localization',
      description: 'Design store screenshots for iPhone, iPad, Android, Mac, Windows, Steam and TV in your browser. Localize every language, prepare A/B variants and let AI agents drive it via WebMCP. Free & open source.',
      path: '/',
    }),
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebApplication',
            name: SITE.name,
            url: absoluteUrl('/editor'),
            applicationCategory: 'DesignApplication',
            operatingSystem: 'Any (web browser)',
            browserRequirements: 'Requires a modern browser with JavaScript, Canvas and IndexedDB',
            description: SITE.description,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: [
              'App Store, Google Play, Mac App Store, Microsoft Store, Steam, Fire TV and Apple TV screenshot sizes',
              'A/B test variants for Product Page Optimization and store listing experiments',
              'Localized copy and screenshots per language with RTL support',
              '2D device frames and 3D iPhone / Galaxy mockups',
              'WebMCP tools for AI agents',
              'ZIP export by variant, platform and language',
            ],
            isAccessibleForFree: true,
            license: 'https://opensource.org/licenses/MIT',
          },
          { '@type': 'WebSite', name: SITE.name, url: SITE.url, description: SITE.description },
          { '@type': 'SoftwareSourceCode', name: 'Storedeck', codeRepository: SITE.github, programmingLanguage: 'TypeScript', license: 'https://opensource.org/licenses/MIT' },
        ],
      }),
    ],
  }),
  component: Home,
})

const SHOWCASE = [
  { src: '/showcase/veena-en-01-dictate.webp', alt: 'Styled iPhone screenshot: “Just Speak. Veena Types.” above the dictation screen', lang: 'EN' },
  { src: '/showcase/veena-te-02-languages-top.webp', alt: 'Telugu version of the languages screenshot', lang: 'తెలుగు' },
  { src: '/showcase/veena-en-04-private.webp', alt: 'Styled screenshot: “Private by Design” above the settings screen', lang: 'EN' },
]

function Home() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-[#0f0b24] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_20%,rgba(124,99,242,0.45),transparent),radial-gradient(40%_50%_at_10%_90%,rgba(56,189,248,0.18),transparent)]" />
        <SiteHeader dark />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-12 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] text-white/80">
              <Sparkles size={14} className="text-brand-300" /> Free · open source · runs in your browser
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[56px]">
              Store screenshots for every platform, language and A/B test.
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-white/75">
              Design App Store, Google Play, Mac, Windows, Steam and TV listings in one place. Localize every screen, prepare test variants, and let AI agents do the busywork through WebMCP.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/editor" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-semibold text-zinc-950 shadow-lg shadow-brand-900/40 hover:bg-brand-50">
                Start designing <ArrowRight size={17} />
              </Link>
              <Link to="/guides" className="inline-flex items-center rounded-xl border border-white/20 px-5 py-3 text-[15px] font-medium text-white hover:bg-white/10">
                Read the guides
              </Link>
            </div>
            <p className="mt-6 text-[13px] text-white/55">No sign-up. Projects stay on your device.</p>
          </div>
          <div className="relative mx-auto flex h-[460px] w-full max-w-[520px] items-center justify-center" aria-label="Example screenshots made with Storedeck">
            {SHOWCASE.map((s, i) => (
              <figure
                key={s.src}
                className="absolute w-[46%] overflow-hidden rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10"
                style={{ transform: `translateX(${(i - 1) * 62}%) rotate(${(i - 1) * 6}deg) translateY(${i === 1 ? -16 : 12}px)`, zIndex: i === 1 ? 2 : 1 }}
              >
                <img src={s.src} alt={s.alt} width={440} height={956} loading={i === 1 ? 'eager' : 'lazy'} className="block h-auto w-full" />
                <figcaption className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium">{s.lang}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-100 bg-zinc-50/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-6 text-[14px] font-medium text-zinc-500">
          {STORES.map(s => (
            <Link key={s.id} to="/screenshot-sizes/$store" params={{ store: s.slug }} className="hover:text-zinc-900">
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">One deck, every storefront</h2>
          <p className="mt-3 text-[17px] leading-7 text-zinc-600">
            {PLATFORMS.length} platforms across {STORES.length} stores, with the exact sizes and limits each one accepts. Design once, then copy a platform to another — screens, copy and styling rescale to fit.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STORES.filter(s => s.id !== 'web').map(s => (
            <Link key={s.id} to="/screenshot-sizes/$store" params={{ store: s.slug }} className="group rounded-2xl border border-zinc-200 p-5 transition hover:border-brand-300 hover:shadow-lg hover:shadow-brand-100">
              <div className="text-[15px] font-semibold text-zinc-950">{s.name}</div>
              <ul className="mt-3 space-y-1 text-[14px] text-zinc-600">
                {platformsForStore(s.id).map(p => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>{p.name}</span>
                    <span className="tabular-nums text-zinc-400">
                      {p.sizes[0].width}×{p.sizes[0].height}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 group-hover:gap-2">
                All sizes <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-zinc-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">Organized the way store listings actually work</h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-7 text-white/70">Four levels keep hundreds of images manageable — and make it obvious what is live, what is being tested and what is missing.</p>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { icon: FolderTree, title: 'Project', text: 'One app. Its languages, brand and every screenshot set you make for it.' },
              { icon: FlaskConical, title: 'Variant', text: 'An A/B test arm — control, treatment, winner — with its hypothesis.' },
              { icon: MonitorSmartphone, title: 'Platform', text: 'A store + device + size: iPhone 6.9", Android phone, Mac, Apple TV…' },
              { icon: Languages, title: 'Language', text: 'Copy and screenshots per locale, with fallbacks and per-language layout.' },
            ].map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-[13px] text-brand-300">
                  <s.icon size={16} /> Level {i + 1}
                </div>
                <div className="mt-2 text-[18px] font-semibold">{s.title}</div>
                <p className="mt-1.5 text-[14px] leading-6 text-white/65">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Everything a listing needs</h2>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Languages, title: 'Localization built in', text: 'Filename language detection, a strings table with missing translations, RTL rendering, CJK line breaking and per-language sizes.' },
            { icon: Columns2, title: 'A/B variants', text: 'Copy a whole set in one click, change one idea, and compare variants side by side before sending them to PPO or Play experiments.' },
            { icon: Layers3, title: 'Frames for every device', text: '2D phone, tablet, watch, laptop, monitor, window, browser and TV frames — plus 3D iPhone and Galaxy models.' },
            { icon: Boxes, title: 'Resize across platforms', text: 'Start the Android, iPad or TV set from your iPhone set. Type sizes, shadows and layout rescale automatically.' },
            { icon: ScanSearch, title: 'Board view QA', text: 'See every screen in every language at once and catch overflowing headlines or missing captures before review does.' },
            { icon: Download, title: 'Store-ready export', text: 'PNG or JPEG at exact sizes, no alpha, zipped as variant / platform / language — ready to upload.' },
          ].map(f => (
            <div key={f.title}>
              <f.icon size={22} className="text-brand-600" />
              <h3 className="mt-3 text-[17px] font-semibold text-zinc-950">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-7 text-zinc-600">{f.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 flex items-center gap-2 text-[14px] text-zinc-500">
          <Lock size={15} /> Your screenshots never leave the browser — projects live in local IndexedDB storage.
        </p>
      </section>

      <section className="border-y border-zinc-200 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-700">
              <Bot size={16} /> WebMCP
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Your AI agent can drive the whole editor</h2>
            <p className="mt-3 text-[17px] leading-7 text-zinc-600">
              Storedeck registers {TOOL_SPECS.length} typed tools with the browser. Agents upload simulator captures, write and translate headlines, style every platform, check rendered previews for overlaps, and export — while you watch the canvas update.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {TOOL_SPECS.slice(0, 12).map(t => (
                <code key={t.name} className="rounded-md bg-white px-2 py-1 font-mono text-[12px] text-zinc-700 ring-1 ring-zinc-200">
                  {t.name}
                </code>
              ))}
              <span className="px-1 py-1 text-[12px] text-zinc-500">+{TOOL_SPECS.length - 12} more</span>
            </div>
            <Link to="/agents" className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-700 hover:gap-2.5">
              Tool reference & AGENTS.md snippet <ArrowRight size={16} />
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-5 text-[13px] leading-6 text-zinc-100 shadow-xl">
            <code>{`// in a WebMCP-capable browser
await document.modelContext // tools registered by Storedeck

manage_screens({ action: "upload", screenshots: [...] })
set_copy({ entries: [
  { screenIndex: 0, field: "headline", language: "en",
    text: "Just speak. Veena types." },
  { screenIndex: 0, field: "headline", language: "te",
    text: "మాట్లాడండి. వీణా రాస్తుంది." }
]})
manage_variant({ action: "create", name: "Outcome copy",
  hypothesis: "Benefit-first headlines lift installs" })
get_images({ scope: "platform" })   // visual QA
export({ allLanguages: true, delivery: "return" })`}</code>
          </pre>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Guides</h2>
          <Link to="/guides" className="text-[14px] font-medium text-brand-700 hover:underline">
            All guides
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {GUIDES.slice(0, 4).map(g => (
            <Link key={g.slug} to="/guides/$slug" params={{ slug: g.slug }} className="flex flex-col rounded-2xl border border-zinc-200 p-5 transition hover:border-brand-300 hover:shadow-lg hover:shadow-brand-100">
              <span className="text-[12px] font-medium text-brand-700">{g.category}</span>
              <span className="mt-2 text-[16px] leading-6 font-semibold text-zinc-950">{g.title}</span>
              <span className="mt-2 line-clamp-3 text-[14px] leading-6 text-zinc-600">{g.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-8">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Questions</h2>
        <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
          {ALL_FAQ.slice(0, 6).map(f => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-zinc-900">
                {f.q}
                <span className="text-zinc-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="prose-sd mt-2 text-[15px] leading-7">
                <Inline text={f.a} />
              </p>
            </details>
          ))}
        </div>
        <Link to="/faq" className="mt-4 inline-block text-[14px] font-medium text-brand-700 hover:underline">
          More answers
        </Link>
      </section>

      <CtaBand />
      <SiteFooter />
    </div>
  )
}
