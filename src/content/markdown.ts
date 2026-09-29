// Markdown renditions of site content for llms.txt / llms-full.txt.

import { getPlatform, PLATFORMS, SPEC_REVIEWED, STORES, platformsForStore } from '../lib/model/platforms'
import { SITE } from '../lib/site'
import { TOOL_SPECS } from '../lib/webmcp/specs'
import { FAQ } from './faq'
import { GUIDES } from './guides'
import type { Block, Guide } from './types'

const abs = (text: string) => text.replace(/\]\((\/[^)]*)\)/g, `](${SITE.url}$1)`)

export function sizesMarkdown(platformIds: string[]): string {
  const rows = ['| Platform | Size | Pixels | Screenshots |', '| --- | --- | --- | --- |']
  for (const id of platformIds) {
    const p = getPlatform(id)
    if (!p) continue
    p.sizes.forEach((s, i) => {
      rows.push(`| ${i === 0 ? p.name : ''} | ${s.label} | ${s.width} × ${s.height}${p.rotatable ? ' (or rotated)' : ''} | ${i === 0 ? `${p.screenshots.min}${p.screenshots.max ? `–${p.screenshots.max}` : '+'}` : ''} |`)
    })
  }
  return rows.join('\n')
}

function blockMd(b: Block): string {
  switch (b.t) {
    case 'p':
      return abs(b.text)
    case 'h2':
      return `## ${b.text}`
    case 'h3':
      return `### ${b.text}`
    case 'ul':
      return b.items.map(i => `- ${abs(i)}`).join('\n')
    case 'ol':
      return b.items.map((i, n) => `${n + 1}. ${abs(i)}`).join('\n')
    case 'table':
      return [`| ${b.head.join(' | ')} |`, `| ${b.head.map(() => '---').join(' | ')} |`, ...b.rows.map(r => `| ${r.map(abs).join(' | ')} |`)].join('\n')
    case 'callout':
      return `> ${abs(b.text)}`
    case 'code':
      return '```' + (b.lang ?? '') + '\n' + b.code + '\n```'
    case 'sizes':
      return sizesMarkdown(b.platformIds)
  }
}

export function guideMarkdown(g: Guide): string {
  const parts = [`# ${g.title}`, `Source: ${SITE.url}/guides/${g.slug} · Updated ${g.updated}`, g.description, '**Key takeaways**', g.summary.map(s => `- ${abs(s)}`).join('\n'), ...g.blocks.map(blockMd)]
  if (g.faqs?.length) parts.push('## FAQ', ...g.faqs.map(f => `**${f.q}**\n${abs(f.a)}`))
  return parts.join('\n\n')
}

export function llmsTxt(): string {
  return [
    `# ${SITE.name}`,
    `> ${SITE.description}`,
    `Storedeck is a browser-based editor (${SITE.url}/editor) for store screenshots. Projects contain A/B variants; each variant has platform decks (store + device + exact output size) with screens that hold copy and screenshots per language. Everything is stored locally in the browser. The editor exposes ${TOOL_SPECS.length} WebMCP tools (document.modelContext), also callable as window.storedeck.callTool(name, input).`,
    '## Guides',
    ...GUIDES.map(g => `- [${g.title}](${SITE.url}/guides/${g.slug}): ${g.description}`),
    '## Screenshot sizes',
    ...STORES.map(s => `- [${s.name} screenshot sizes](${SITE.url}/screenshot-sizes/${s.slug}): ${platformsForStore(s.id).map(p => p.name).join(', ')}`),
    '## For AI agents',
    `- [WebMCP tool reference](${SITE.url}/agents): all ${TOOL_SPECS.length} tools with parameters`,
    `- [Full text for LLMs](${SITE.url}/llms-full.txt): every guide, the size catalog and tool JSON schemas`,
    `- [FAQ](${SITE.url}/faq)`,
    '## Optional',
    `- [Source code (MIT)](${SITE.github})`,
  ].join('\n\n') + '\n'
}

export function llmsFullTxt(): string {
  const tools = TOOL_SPECS.map(t => `### ${t.name} — ${t.title}\n\n${t.description}\n\n\`\`\`json\n${JSON.stringify(t.inputSchema, null, 2)}\n\`\`\``)
  const faq = FAQ.flatMap(s => [`### ${s.title}`, ...s.items.map(f => `**${f.q}**\n${abs(f.a)}`)])
  return [
    llmsTxt(),
    `# Store screenshot size catalog (checked ${SPEC_REVIEWED})`,
    ...STORES.map(s => `## ${s.name}\n\nSource: ${s.sourceUrl}\n\n${sizesMarkdown(platformsForStore(s.id).map(p => p.id))}\n\n${platformsForStore(s.id).map(p => `- **${p.name}** (\`${p.id}\`): ${p.formats}. ${p.requirements.join(' ')}`).join('\n')}`),
    `Platform ids: ${PLATFORMS.map(p => p.id).join(', ')}`,
    '# Guides',
    ...GUIDES.map(guideMarkdown),
    '# FAQ',
    ...faq,
    '# WebMCP tools',
    ...tools,
  ].join('\n\n') + '\n'
}
