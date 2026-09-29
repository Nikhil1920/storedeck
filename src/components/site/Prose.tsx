import { Link } from '@tanstack/react-router'
import { Info, Lightbulb, TriangleAlert } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import type { Block } from '~/content/types'
import { slugify } from '~/content/types'
import { getPlatform } from '~/lib/model/platforms'

/** Renders **bold**, `code` and [text](href) inline markup. */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>)
    else if (m[2]) out.push(<code key={k++}>{m[2]}</code>)
    else if (m[3] && m[4]) {
      const href = m[4]
      out.push(
        href.startsWith('/') ? (
          <Link key={k++} to={href as never}>
            {m[3]}
          </Link>
        ) : (
          <a key={k++} href={href} rel="noopener" target="_blank">
            {m[3]}
          </a>
        ),
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>
}

export function SizesTable({ platformIds }: { platformIds: string[] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-zinc-200">
      <table className="!my-0 w-full text-[14px]">
        <thead className="bg-zinc-50">
          <tr>
            <th className="!py-2.5 !pl-4">Platform</th>
            <th>Size</th>
            <th>Pixels</th>
            <th className="!pr-4">Screenshots</th>
          </tr>
        </thead>
        <tbody>
          {platformIds.flatMap(id => {
            const p = getPlatform(id)
            if (!p) return []
            return p.sizes.map((s, i) => (
              <tr key={s.id}>
                <td className="!pl-4">{i === 0 ? <strong>{p.name}</strong> : ''}</td>
                <td>
                  {s.label}
                  {s.note && <span className="block text-[12px] text-zinc-500">{s.note}</span>}
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {s.width} × {s.height}
                  {p.rotatable && <span className="block text-[12px] text-zinc-500">or {s.height} × {s.width}</span>}
                </td>
                <td className="!pr-4 whitespace-nowrap">{i === 0 ? `${p.screenshots.min}${p.screenshots.max ? `–${p.screenshots.max}` : '+'}` : ''}</td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}

const CALLOUT = {
  tip: { icon: Lightbulb, cls: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
  note: { icon: Info, cls: 'border-brand-200 bg-brand-50 text-brand-900' },
  warn: { icon: TriangleAlert, cls: 'border-amber-200 bg-amber-50 text-amber-950' },
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            )
          case 'h2':
            return (
              <h2 key={i} id={b.id ?? slugify(b.text)}>
                {b.text}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i} id={slugify(b.text)}>
                {b.text}
              </h3>
            )
          case 'ul':
          case 'ol': {
            const Tag = b.t
            return (
              <Tag key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </Tag>
            )
          }
          case 'table':
            return (
              <div key={i} className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      {b.head.map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'callout': {
            const { icon: Icon, cls } = CALLOUT[b.tone ?? 'note']
            return (
              <div key={i} className={`my-6 flex gap-3 rounded-xl border px-4 py-3.5 text-[15px] leading-7 ${cls}`}>
                <Icon size={18} className="mt-1 shrink-0" />
                <div>
                  <Inline text={b.text} />
                </div>
              </div>
            )
          }
          case 'code':
            return (
              <pre key={i} className="my-6 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-100">
                <code>{b.code}</code>
              </pre>
            )
          case 'sizes':
            return <SizesTable key={i} platformIds={b.platformIds} />
        }
      })}
    </>
  )
}
