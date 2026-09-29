import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '~/components/Logo'
import { SITE } from '~/lib/site'

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width="19" height="19" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const NAV = [
  { to: '/guides', label: 'Guides' },
  { to: '/screenshot-sizes', label: 'Screenshot sizes' },
  { to: '/agents', label: 'For AI agents' },
  { to: '/faq', label: 'FAQ' },
] as const

export function SiteHeader({ dark }: { dark?: boolean }) {
  return (
    <header className={dark ? 'relative z-20 text-white' : 'sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 text-zinc-900 backdrop-blur'}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link to="/" aria-label="Storedeck home">
          <Logo className="text-[17px]" />
        </Link>
        <nav className="hidden items-center gap-5 text-[14px] md:flex" aria-label="Main">
          {NAV.map(n => (
            <Link key={n.to} to={n.to} className={dark ? 'text-white/75 hover:text-white' : 'text-zinc-600 hover:text-zinc-950'} activeProps={{ className: dark ? 'text-white' : 'text-zinc-950 font-medium' }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <a href={SITE.github} className={`hidden sm:flex ${dark ? 'text-white/70 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`} aria-label="Storedeck on GitHub">
          <GithubMark />
        </a>
        <Link to="/editor" className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition ${dark ? 'bg-white text-zinc-950 hover:bg-brand-50' : 'bg-zinc-950 text-white hover:bg-zinc-800'}`}>
          Open editor <ArrowRight size={15} />
        </Link>
      </div>
      <nav className="flex gap-5 overflow-x-auto px-5 pb-3 text-[14px] md:hidden" aria-label="Main (mobile)">
        {NAV.map(n => (
          <Link key={n.to} to={n.to} className={`shrink-0 ${dark ? 'text-white/75' : 'text-zinc-600'}`} activeProps={{ className: dark ? 'text-white' : 'font-medium text-zinc-950' }}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo className="text-[16px] text-zinc-900" />
          <p className="mt-3 max-w-xs text-[14px] leading-6 text-zinc-600">{SITE.description}</p>
        </div>
        <FooterCol
          title="Product"
          links={[
            { to: '/editor', label: 'Editor' },
            { to: '/agents', label: 'WebMCP tools for agents' },
            { to: '/faq', label: 'FAQ' },
            { href: SITE.github, label: 'GitHub (MIT)' },
          ]}
        />
        <FooterCol
          title="Screenshot sizes"
          links={[
            { to: '/screenshot-sizes/app-store', label: 'App Store' },
            { to: '/screenshot-sizes/google-play', label: 'Google Play' },
            { to: '/screenshot-sizes/microsoft-store', label: 'Microsoft Store' },
            { to: '/screenshot-sizes/steam', label: 'Steam' },
            { to: '/screenshot-sizes/amazon-appstore', label: 'Amazon Fire TV' },
          ]}
        />
        <FooterCol
          title="Guides"
          links={[
            { to: '/guides/app-store-screenshot-sizes', label: 'App Store sizes' },
            { to: '/guides/ab-testing-store-screenshots', label: 'A/B testing screenshots' },
            { to: '/guides/localize-app-store-screenshots', label: 'Localizing screenshots' },
            { to: '/guides/screenshot-copywriting', label: 'Writing headlines' },
            { to: '/guides/automate-store-screenshots-with-ai-agents', label: 'Automating with AI agents' },
          ]}
        />
      </div>
      <div className="border-t border-zinc-200 py-6 text-center text-[13px] text-zinc-500">
        Storedeck is free and open source. Your projects never leave your browser. Not affiliated with Apple, Google, Microsoft, Valve or Amazon.
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: Array<{ to?: string; href?: string; label: string }> }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-zinc-900">{title}</div>
      <ul className="mt-3 space-y-2 text-[14px]">
        {links.map(l => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to as never} className="text-zinc-600 hover:text-zinc-950">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} className="text-zinc-600 hover:text-zinc-950">
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-zinc-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.to ? (
              <Link to={it.to as never} className="hover:text-zinc-900">
                {it.label}
              </Link>
            ) : (
              <span className="text-zinc-700" aria-current="page">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function CtaBand({ title = 'Design your store screenshots now', text = 'Free, in your browser, no sign-up. Projects are saved locally.' }: { title?: string; text?: string }) {
  return (
    <section className="mx-auto my-16 max-w-6xl px-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1b1446] via-[#3e2e82] to-[#6a4de6] px-8 py-12 text-white sm:px-12">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-3 text-[16px] leading-7 text-white/80">{text}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/editor" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-[15px] font-semibold text-zinc-950 hover:bg-brand-50">
              Open the editor <ArrowRight size={16} />
            </Link>
            <Link to="/agents" className="inline-flex items-center rounded-lg border border-white/30 px-4 py-2.5 text-[15px] font-medium text-white hover:bg-white/10">
              Let an AI agent do it
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
