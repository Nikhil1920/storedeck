import { ArrowRightLeft, Languages } from 'lucide-react'
import { useMemo, useState } from 'react'
import * as A from '~/lib/editor/actions'
import { select, setUi, toast, useEditor } from '~/lib/editor/store'
import { getLanguage } from '~/lib/model/languages'
import { collectStrings, type StringRow } from '~/lib/model/ops'
import { getPlatform, resolveDeckSize } from '~/lib/model/platforms'
import type { PlatformDeck, Variant } from '~/lib/model/types'
import { ScreenCanvas, useCurrent } from './ScreenCanvas'
import { EmptyState, Popover, MenuItem, cx } from './ui'

// ---------------------------------------------------------------- board

export function BoardView() {
  const c = useCurrent()
  if (!c?.deck) return null
  const deck = c.deck
  const size = resolveDeckSize(deck)
  const cellW = size.width > size.height ? 260 : 150
  if (!deck.screens.length) return <EmptyState icon={<Languages size={28} />} title="No screens in this platform yet" />
  return (
    <div className="ed-scroll h-full overflow-auto bg-ed-bg p-6">
      <p className="mb-4 text-[12px] text-ed-muted">
        Every screen in every language — {getPlatform(deck.platformId)?.name}, {size.width}×{size.height}. Click a cell to edit it.
      </p>
      <table className="border-separate border-spacing-3">
        <tbody>
          {c.project.languages.map(lang => (
            <tr key={lang}>
              <th className="sticky left-0 z-10 bg-ed-bg pr-2 text-left align-middle text-[12px] font-medium text-ed-muted">
                <div className="text-lg">{getLanguage(lang).flag}</div>
                {getLanguage(lang).name}
              </th>
              {deck.screens.map(screen => {
                const missing = screen.text.headline.enabled && !screen.copy.headline[lang]?.trim()
                return (
                  <td key={screen.id} className="align-top">
                    <button
                      type="button"
                      onClick={() => {
                        select({ screenId: screen.id, language: lang })
                        setUi({ view: 'design' })
                      }}
                      className={cx('relative block overflow-hidden rounded-md ring-2 transition hover:ring-brand-400', screen.id === c.screen?.id && lang === c.lang ? 'ring-brand-500' : 'ring-transparent')}
                    >
                      <ScreenCanvas screen={screen} size={size} lang={lang} cssWidth={cellW} quality={0.8} />
                      {missing && <span className="absolute top-1.5 right-1.5 rounded bg-amber-500 px-1.5 text-[10px] font-semibold text-black">no copy</span>}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- strings

function fieldLabel(row: StringRow) {
  if (row.field === 'headline') return 'Headline'
  if (row.field === 'subheadline') return 'Subheadline'
  return 'Text element'
}

export function StringsView() {
  const c = useCurrent()
  const project = useEditor(s => s.project)
  const [scope, setScope] = useState<'platform' | 'variant'>('platform')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const rows = useMemo(() => {
    if (!project || !c?.variant) return []
    const all = collectStrings(project, scope === 'platform' ? { deckId: c.deck?.id } : { variantId: c.variant.id })
    return onlyMissing ? all.filter(r => Object.values(r.values).some(v => v?.trim()) && project.languages.some(l => !r.values[l]?.trim())) : all
  }, [project, c?.variant, c?.deck?.id, scope, onlyMissing])
  if (!c || !project) return null
  const decks = c.variant?.decks ?? []
  return (
    <div className="flex h-full flex-col bg-ed-bg">
      <div className="flex items-center gap-3 border-b border-ed-border px-5 py-2.5">
        <span className="text-[13px] font-semibold">Localization strings</span>
        <select className="ed-select w-auto" value={scope} onChange={e => setScope(e.target.value as 'platform' | 'variant')}>
          <option value="platform">This platform</option>
          <option value="variant">All platforms in {c.variant?.name}</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-ed-muted">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} /> Only missing translations
        </label>
        <div className="flex-1" />
        {decks.length > 1 && c.deck && (
          <Popover
            align="right"
            width={280}
            trigger={(_, toggle) => (
              <button type="button" className="ed-btn" onClick={toggle}>
                <ArrowRightLeft size={13} /> Copy strings from…
              </button>
            )}
          >
            {close => (
              <div>
                {decks
                  .filter(d => d.id !== c.deck!.id)
                  .map(d => (
                    <MenuItem
                      key={d.id}
                      onClick={() => {
                        const n = A.copyStringsBetweenDecks(d.id, c.deck!.id)
                        toast(`Copied ${n} strings from ${getPlatform(d.platformId)?.name}`, 'success')
                        close()
                      }}
                    >
                      {getPlatform(d.platformId)?.name} ({d.screens.length} screens)
                    </MenuItem>
                  ))}
              </div>
            )}
          </Popover>
        )}
      </div>
      {!rows.length ? (
        <EmptyState icon={<Languages size={28} />} title={onlyMissing ? 'Everything is translated' : 'No strings yet'}>
          {onlyMissing ? 'Every string has a value in every project language.' : 'Add screens and write headlines to see them here.'}
        </EmptyState>
      ) : (
        <div className="ed-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-ed-panel">
              <tr>
                <th className="w-44 border-b border-ed-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ed-muted">Screen</th>
                {project.languages.map(l => (
                  <th key={l} className="min-w-56 border-b border-ed-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ed-muted">
                    {getLanguage(l).flag} {getLanguage(l).name}
                    {l === project.defaultLanguage && <span className="ml-1 normal-case text-ed-faint">(default)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={`${row.screenId}:${row.field}`} className="align-top">
                  <td className="border-b border-ed-border px-3 py-2">
                    <button type="button" className="text-left" onClick={() => (select({ screenId: row.screenId }), setUi({ view: 'design' }))}>
                      <div className="text-[12px] font-medium text-ed-text">
                        {row.screenIndex + 1}. {row.screenName}
                      </div>
                      <div className="text-[11px] text-ed-faint">
                        {fieldLabel(row)}
                        {scope === 'variant' && ` · ${getPlatform(decks.find(d => d.id === row.deckId)?.platformId ?? '')?.name ?? ''}`}
                      </div>
                    </button>
                  </td>
                  {project.languages.map(l => {
                    const value = row.values[l] ?? ''
                    const missing = !value.trim() && Object.values(row.values).some(v => v?.trim())
                    return (
                      <td key={l} className="border-b border-ed-border p-1.5">
                        <textarea
                          dir={getLanguage(l).rtl ? 'rtl' : 'ltr'}
                          lang={l}
                          value={value}
                          rows={2}
                          onChange={e => A.setCopy([{ screenId: row.screenId, field: row.field, language: l, text: e.target.value }], `str:${row.screenId}:${row.field}:${l}`)}
                          className={cx('w-full resize-y rounded-md border bg-transparent px-2 py-1.5 text-[13px] leading-5 text-ed-text outline-none focus:border-brand-500', missing ? 'border-amber-500/50 bg-amber-500/5' : 'border-transparent hover:border-ed-border')}
                          placeholder={missing ? 'Missing translation' : ''}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- compare

export function CompareView() {
  const c = useCurrent()
  const compareIds = useEditor(s => s.ui.compareVariantIds)
  if (!c?.deck) return null
  const platformId = c.deck.platformId
  const variants: Variant[] = (compareIds.length ? c.project.variants.filter(v => compareIds.includes(v.id)) : c.project.variants).slice(0, 4)
  if (c.project.variants.length < 2) {
    return (
      <EmptyState icon={<ArrowRightLeft size={28} />} title="Create a second variant to compare">
        Use the + next to the variant tabs. It copies the current variant so you only change what the test is about — headlines, colors, order or device style.
        <div className="mt-3">
          <button type="button" className="ed-btn-primary" onClick={() => A.addVariant()}>
            New variant
          </button>
        </div>
      </EmptyState>
    )
  }
  return (
    <div className="ed-scroll h-full space-y-6 overflow-auto bg-ed-bg p-6">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ed-muted">
        Comparing {getPlatform(platformId)?.name} in {getLanguage(c.lang).flag} {getLanguage(c.lang).name} — as shoppers see the first screens of your listing.
        <span className="flex-1" />
        {c.project.variants.map(v => {
          const on = compareIds.length ? compareIds.includes(v.id) : true
          return (
            <label key={v.id} className="flex items-center gap-1 rounded-md border border-ed-border px-2 py-1">
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  const base = compareIds.length ? compareIds : c.project.variants.map(x => x.id)
                  setUi({ compareVariantIds: on ? base.filter(x => x !== v.id) : [...base, v.id] })
                }}
              />
              {v.name}
            </label>
          )
        })}
      </div>
      {variants.map(v => {
        const deck: PlatformDeck | undefined = v.decks.find(d => d.platformId === platformId)
        return (
          <section key={v.id} className="rounded-xl border border-ed-border bg-ed-panel p-4">
            <header className="mb-3 flex items-center gap-2">
              <button type="button" className="text-[14px] font-semibold text-ed-text hover:underline" onClick={() => (select({ variantId: v.id }), setUi({ view: 'design' }))}>
                {v.name}
              </button>
              <span className="ed-chip uppercase">{v.status}</span>
              {v.hypothesis && <span className="truncate text-[12px] text-ed-muted">— {v.hypothesis}</span>}
            </header>
            {!deck ? (
              <p className="text-[12px] text-ed-faint">This variant has no {getPlatform(platformId)?.name} platform.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {deck.screens.map((s, i) => (
                  <button key={s.id} type="button" onClick={() => (select({ variantId: v.id, deckId: deck.id, screenId: s.id }), setUi({ view: 'design' }))} className="shrink-0 overflow-hidden rounded-md ring-1 ring-ed-border hover:ring-brand-400" title={`${i + 1}. ${s.name}`}>
                    <ScreenCanvas screen={s} size={resolveDeckSize(deck)} lang={c.lang} cssWidth={resolveDeckSize(deck).width > resolveDeckSize(deck).height ? 280 : 150} quality={0.8} />
                  </button>
                ))}
                {!deck.screens.length && <p className="text-[12px] text-ed-faint">No screens yet.</p>}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
