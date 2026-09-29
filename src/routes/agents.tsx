import { Link, createFileRoute } from '@tanstack/react-router'
import { Bot, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Breadcrumbs, CtaBand, SitePage } from '~/components/site/SiteLayout'
import { TOOL_SPECS, type ToolSpec } from '~/lib/webmcp/specs'
import type { JsonSchema } from '~/lib/webmcp/schema'
import { SITE, absoluteUrl, jsonLd, seo } from '~/lib/site'
import snippet from '../../AGENTS_SNIPPET.md?raw'

export const Route = createFileRoute('/agents')({
  head: () => ({
    ...seo({
      title: `WebMCP tools for AI agents — ${TOOL_SPECS.length} tools to automate store screenshots — Storedeck`,
      description: `Storedeck exposes ${TOOL_SPECS.length} WebMCP tools so AI agents can create projects, A/B variants, platforms and localized App Store / Google Play screenshots, review renders and export.`,
      path: '/agents',
      type: 'article',
    }),
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: 'Storedeck WebMCP tool reference',
        url: absoluteUrl('/agents'),
        author: { '@type': 'Organization', name: SITE.name },
        about: ['WebMCP', 'AI agents', 'App Store screenshots', 'Google Play screenshots'],
      }),
    ],
  }),
  component: AgentsPage,
})

function typeLabel(s: JsonSchema): string {
  if (s.enum) return s.enum.map(v => JSON.stringify(v)).join(' | ')
  if (s.anyOf) return s.anyOf.map(typeLabel).join(' | ')
  if (s.type === 'array') return `${s.items ? typeLabel(s.items) : 'any'}[]`
  if (s.type === 'object' && s.properties) return `{ ${Object.keys(s.properties).join(', ')} }`
  return s.type ?? 'any'
}

function ToolCard({ tool }: { tool: ToolSpec }) {
  const props = Object.entries(tool.inputSchema.properties ?? {})
  const required = new Set(tool.inputSchema.required ?? [])
  return (
    <section id={tool.name} className="scroll-mt-24 rounded-2xl border border-zinc-200 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-[16px] font-semibold text-zinc-950">{tool.name}</h3>
        <span className="text-[13px] text-zinc-500">{tool.title}</span>
        {tool.annotations.readOnlyHint && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">read-only</span>}
      </div>
      <p className="mt-2 text-[15px] leading-7 [overflow-wrap:anywhere] text-zinc-700">{tool.description}</p>
      {props.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-brand-700">Parameters ({props.length})</summary>
          <table className="mt-2 w-full table-fixed text-left text-[13px]">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[27%]" />
              <col />
            </colgroup>
            <tbody>
              {props.map(([name, schema]) => (
                <tr key={name} className="border-t border-zinc-100 align-top">
                  <td className="py-1.5 pr-3 font-mono [overflow-wrap:anywhere] text-zinc-900">
                    {name}
                    {required.has(name) && <span className="text-red-500">*</span>}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[12px] [overflow-wrap:anywhere] text-zinc-500">{typeLabel(schema)}</td>
                  <td className="py-1.5 [overflow-wrap:anywhere] text-zinc-600">{schema.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  )
}

function AgentsPage() {
  const [copied, setCopied] = useState(false)
  const groups = [...new Set(TOOL_SPECS.map(t => t.group))]
  return (
    <SitePage>
      <div className="mx-auto max-w-4xl px-5 pt-10">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'For AI agents' }]} />
        <p className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-700">
          <Bot size={16} /> WebMCP
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-950">Let AI agents make your store screenshots</h1>
        <p className="mt-4 text-[18px] leading-8 text-zinc-600">
          Storedeck registers {TOOL_SPECS.length} tools with <code className="rounded bg-zinc-100 px-1.5 font-mono text-[0.85em]">document.modelContext</code> — the{' '}
          <a href="https://webmachinelearning.github.io/webmcp/" className="font-medium text-brand-700 underline decoration-brand-300" target="_blank" rel="noopener">
            WebMCP
          </a>{' '}
          API — covering everything the editor can do. An agent can run the whole job, from simulator captures to localized, A/B-ready exports, while you watch the canvas.
        </p>
      </div>

      <div className="prose-sd mx-auto max-w-4xl px-5">
        <h2>How agents connect</h2>
        <ul>
          <li>
            <strong>WebMCP-capable browsers and agent runtimes</strong> discover the tools automatically on any Storedeck page; calling one opens the editor if needed.
          </li>
          <li>
            <strong>Browser automation without WebMCP</strong> (Playwright, CDP, <a href="https://github.com/vercel-labs/agent-browser">agent-browser</a> eval): call the same tools through <code>{'await window.storedeck.callTool("get_app_state", {})'}</code> and list them with <code>window.storedeck.listTools()</code>.
          </li>
          <li>
            Inputs are validated against the published JSON schemas and errors explain what to fix, so agents can self-correct.
          </li>
        </ul>

        <h2>The model agents work with</h2>
        <p>
          <strong>Project</strong> (one app, its languages) → <strong>variants</strong> (A/B test arms with status and hypothesis) → <strong>platform decks</strong> (store + device + exact size) → <strong>screens</strong> (images and copy per language, background, device, text, elements, popouts). Every id is returned by <code>get_app_state</code>; most tools also accept <code>screenIndex</code> and default to the current selection, and design tools take a <code>scope</code> of <code>screen</code>, <code>platform</code> or <code>variant</code>.
        </p>

        <h2>A complete run</h2>
        <ol>
          <li>
            <code>get_app_state</code> → pick or create a project with <code>manage_project</code>.
          </li>
          <li>
            <code>manage_screens</code> upload with data URLs; <code>get_images</code> mode <code>original</code> to read the app.
          </li>
          <li>
            <code>set_copy</code> with every screen × language in one call.
          </li>
          <li>
            <code>set_background</code>, <code>set_device</code>, <code>set_text_style</code> with <code>scope: "platform"</code>.
          </li>
          <li>
            <code>get_images</code> (rendered) + <code>get_screen</code> layout warnings → fix → repeat.
          </li>
          <li>
            <code>manage_platform</code> add with <code>cloneFromDeckId</code> for Android, iPad, Mac or TV; <code>manage_variant</code> create for A/B tests.
          </li>
          <li>
            <code>export</code> and save the PNGs.
          </li>
        </ol>
      </div>

      <section id="agents-md" className="mx-auto mt-10 max-w-4xl scroll-mt-24 px-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Add this to your repo's AGENTS.md</h2>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50"
            onClick={() => {
              void navigator.clipboard.writeText(snippet).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-[15px] text-zinc-600">Coding agents (Claude Code, Codex, Cursor…) read AGENTS.md. With this section they can refresh your store screenshots on request — capture, design, review with you, export.</p>
        <pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl bg-zinc-950 p-5 text-[13px] leading-6 whitespace-pre-wrap text-zinc-100">
          <code>{snippet}</code>
        </pre>
      </section>

      <div className="mx-auto mt-14 max-w-4xl px-5">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Tool reference</h2>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Tools">
          {TOOL_SPECS.map(t => (
            <a key={t.name} href={`#${t.name}`} className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[12px] text-zinc-700 hover:bg-brand-50">
              {t.name}
            </a>
          ))}
        </nav>
        {groups.map(g => (
          <div key={g} className="mt-10">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">{g}</h3>
            <div className="mt-4 space-y-4">
              {TOOL_SPECS.filter(t => t.group === g).map(t => (
                <ToolCard key={t.name} tool={t} />
              ))}
            </div>
          </div>
        ))}
        <p className="mt-8 text-[14px] text-zinc-500">
          Want the machine-readable version? The same schemas are served at <a href="/llms.txt" className="underline">/llms.txt</a>, and <Link to="/guides/$slug" params={{ slug: 'automate-store-screenshots-with-ai-agents' }} className="underline">the automation guide</Link> walks through a full example.
        </p>
      </div>
      <CtaBand title="Try it with your agent" text="Open the editor in a WebMCP-capable browser and ask your agent to “make App Store screenshots for my app”." />
    </SitePage>
  )
}
