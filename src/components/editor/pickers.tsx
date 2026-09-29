import { Search, Type } from 'lucide-react'
import { createElement, useEffect, useMemo, useState } from 'react'
import { EMOJI_CATEGORIES, searchEmoji } from '~/lib/model/emoji'
import { fetchGoogleFontList, googleFamilyOf, loadGoogleFont, POPULAR_GOOGLE_FONTS, primaryFamily, SYSTEM_FONTS } from '~/lib/render/fonts'
import { loadIconSet, POPULAR_ICONS, toKebab, toPascal } from '~/lib/render/icons'
import { Popover, cx } from './ui'

export function FontPicker({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<string[] | null>(null)
  const family = primaryFamily(value)
  const current = SYSTEM_FONTS.find(f => f.value === value)?.name ?? family
  useEffect(() => {
    const g = googleFamilyOf(value)
    if (g) void loadGoogleFont(g)
  }, [value])
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const google = (all ?? POPULAR_GOOGLE_FONTS).filter(f => !q || f.toLowerCase().includes(q)).slice(0, 150)
    const system = SYSTEM_FONTS.filter(f => !q || f.name.toLowerCase().includes(q))
    return { google, system }
  }, [query, all])
  return (
    <Popover
      width={280}
      trigger={(_, toggle) => (
        <button type="button" onClick={toggle} className="ed-input flex items-center justify-between text-left">
          <span className="truncate" style={{ fontFamily: googleFamilyOf(value) ? `"${family}"` : value }}>
            {current}
          </span>
          <Type size={13} className="shrink-0 text-ed-faint" />
        </button>
      )}
    >
      {close => (
        <div className="flex max-h-80 flex-col">
          <div className="relative p-1">
            <Search size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-ed-faint" />
            <input
              autoFocus
              className="ed-input pl-7"
              placeholder="Search fonts…"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                if (!all && e.target.value.length > 1) void fetchGoogleFontList().then(setAll)
              }}
            />
          </div>
          <div className="ed-scroll min-h-0 flex-1 overflow-y-auto p-1">
            {list.system.length > 0 && <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ed-faint">System</div>}
            {list.system.map(f => (
              <FontRow key={f.name} label={f.name} style={f.value} active={f.value === value} onClick={() => (onChange(f.value), close())} />
            ))}
            <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ed-faint">Google Fonts {all ? `(${all.length})` : ''}</div>
            {list.google.map(f => (
              <FontRow
                key={f}
                label={f}
                style={`"${f}"`}
                active={family === f}
                onClick={() => {
                  void loadGoogleFont(f)
                  onChange(f)
                  close()
                }}
                onHover={() => void loadGoogleFont(f)}
              />
            ))}
            {!all && (
              <button type="button" className="w-full px-2 py-2 text-left text-[12px] text-brand-300 hover:underline" onClick={() => void fetchGoogleFontList().then(setAll)}>
                Show all Google Fonts…
              </button>
            )}
          </div>
        </div>
      )}
    </Popover>
  )
}

function FontRow({ label, style, active, onClick, onHover }: { label: string; style: string; active: boolean; onClick: () => void; onHover?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={cx('block w-full truncate rounded px-2 py-1.5 text-left text-[14px] hover:bg-ed-hover', active ? 'text-brand-300' : 'text-ed-text')}
      style={{ fontFamily: style }}
    >
      {label}
    </button>
  )
}

export function EmojiPicker({ onPick, children }: { onPick: (emoji: string, name: string) => void; children: (toggle: () => void) => React.ReactNode }) {
  const [cat, setCat] = useState('popular')
  const [query, setQuery] = useState('')
  const items = query ? searchEmoji(query) : EMOJI_CATEGORIES[cat]
  return (
    <Popover width={300} trigger={(_, toggle) => children(toggle)}>
      {close => (
        <div className="space-y-2 p-1">
          <input autoFocus className="ed-input" placeholder="Search emoji…" value={query} onChange={e => setQuery(e.target.value)} />
          {!query && (
            <div className="flex flex-wrap gap-1">
              {Object.keys(EMOJI_CATEGORIES).map(c => (
                <button key={c} type="button" onClick={() => setCat(c)} className={cx('rounded px-1.5 py-0.5 text-[11px] capitalize', c === cat ? 'bg-brand-500 text-white' : 'text-ed-muted hover:bg-ed-hover')}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="ed-scroll grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
            {items.map(([emoji, name]) => (
              <button key={emoji + name} type="button" title={name} onClick={() => (onPick(emoji, name), close())} className="rounded p-1 text-xl hover:bg-ed-hover">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  )
}

type IconNode = Array<[string, Record<string, string | number>]>

export function LucideGlyph({ name, size = 18, icons }: { name: string; size?: number; icons: Record<string, IconNode> }) {
  const node = icons[toPascal(name)]
  if (!node) return null
  return createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    node.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })),
  )
}

export function IconPicker({ onPick, children }: { onPick: (name: string) => void; children: (toggle: () => void) => React.ReactNode }) {
  const [icons, setIcons] = useState<Record<string, IconNode> | null>(null)
  const [query, setQuery] = useState('')
  const names = useMemo(() => {
    if (!icons) return []
    const q = query.trim().toLowerCase()
    if (!q) return POPULAR_ICONS.filter(n => toPascal(n) in icons)
    return Object.keys(icons)
      .map(toKebab)
      .filter(n => n.includes(q))
      .slice(0, 160)
  }, [icons, query])
  return (
    <Popover
      width={300}
      trigger={(_, toggle) =>
        children(() => {
          if (!icons) void loadIconSet().then(setIcons)
          toggle()
        })
      }
    >
      {close => (
        <div className="space-y-2 p-1">
          <input autoFocus className="ed-input" placeholder="Search 1,900+ icons…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="ed-scroll grid max-h-60 grid-cols-7 gap-0.5 overflow-y-auto text-ed-text">
            {!icons && <div className="col-span-7 py-6 text-center text-[12px] text-ed-muted">Loading icons…</div>}
            {icons &&
              names.map(n => (
                <button key={n} type="button" title={n} onClick={() => (onPick(n), close())} className="flex aspect-square items-center justify-center rounded hover:bg-ed-hover">
                  <LucideGlyph name={n} icons={icons} />
                </button>
              ))}
          </div>
        </div>
      )}
    </Popover>
  )
}
