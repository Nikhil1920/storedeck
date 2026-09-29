import { Copy, GripVertical, ImagePlus, MoreHorizontal, Plus, RectangleHorizontal, RectangleVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import * as A from '~/lib/editor/actions'
import { select, toast } from '~/lib/editor/store'
import { getLanguage } from '~/lib/model/languages'
import { getPlatform, getStore, PLATFORMS, resolveDeckSize, STORES } from '~/lib/model/platforms'
import type { PlatformDeck } from '~/lib/model/types'
import { ScreenCanvas, useCurrent } from './ScreenCanvas'
import { Dialog, MenuDivider, MenuItem, Popover, cx } from './ui'

export function StoreBadge({ store, className }: { store: string; className?: string }) {
  const colors: Record<string, string> = {
    'app-store': 'bg-sky-500/15 text-sky-300',
    'google-play': 'bg-emerald-500/15 text-emerald-300',
    'microsoft-store': 'bg-blue-500/15 text-blue-300',
    steam: 'bg-slate-400/15 text-slate-300',
    'amazon-appstore': 'bg-amber-500/15 text-amber-300',
    'tv-stores': 'bg-fuchsia-500/15 text-fuchsia-300',
    web: 'bg-zinc-400/15 text-zinc-300',
  }
  const short: Record<string, string> = { 'app-store': 'Apple', 'google-play': 'Play', 'microsoft-store': 'MS', steam: 'Steam', 'amazon-appstore': 'Amazon', 'tv-stores': 'TV', web: 'Web' }
  return <span className={cx('rounded px-1.5 py-px text-[10px] font-semibold', colors[store], className)}>{short[store] ?? store}</span>
}

export function Sidebar({ onUploadClick }: { onUploadClick: () => void }) {
  const c = useCurrent()
  const [adding, setAdding] = useState(false)
  if (!c?.variant) return null
  const variant = c.variant
  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-ed-border bg-ed-panel">
      <div className="border-b border-ed-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="ed-label">Platforms</span>
          <button type="button" className="ed-icon-btn size-6" onClick={() => setAdding(true)} title="Add platform" aria-label="Add platform">
            <Plus size={14} />
          </button>
        </div>
        <ul className="space-y-0.5">
          {variant.decks.map(deck => (
            <DeckRow key={deck.id} deck={deck} active={deck.id === c.deck?.id} canRemove={variant.decks.length > 1} />
          ))}
        </ul>
      </div>
      {c.deck && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="ed-label">
              Screens <span className="text-ed-faint">{c.deck.screens.length}</span>
              <ScreenCountHint deck={c.deck} />
            </span>
            <div className="flex gap-0.5">
              <button type="button" className="ed-icon-btn size-6" onClick={() => A.addBlankScreen()} title="Add blank screen" aria-label="Add blank screen">
                <Plus size={14} />
              </button>
              <button type="button" className="ed-icon-btn size-6" onClick={onUploadClick} title="Upload screenshots" aria-label="Upload screenshots">
                <ImagePlus size={14} />
              </button>
            </div>
          </div>
          <ScreenList deck={c.deck} activeId={c.screen?.id ?? null} lang={c.lang} />
        </div>
      )}
      <AddPlatformDialog open={adding} onClose={() => setAdding(false)} />
    </aside>
  )
}

function ScreenCountHint({ deck }: { deck: PlatformDeck }) {
  const p = getPlatform(deck.platformId)
  if (!p || !deck.screens.length) return null
  const low = deck.screens.length < p.screenshots.min
  const high = p.screenshots.max !== undefined && deck.screens.length > p.screenshots.max
  if (!low && !high) return null
  return (
    <span className="ml-1.5 normal-case tracking-normal text-amber-300" title={`${p.name}: ${p.screenshots.min}–${p.screenshots.max ?? '∞'} screenshots`}>
      · {low ? `min ${p.screenshots.min}` : `max ${p.screenshots.max}`}
    </span>
  )
}

function DeckRow({ deck, active, canRemove }: { deck: PlatformDeck; active: boolean; canRemove: boolean }) {
  const platform = getPlatform(deck.platformId)
  const size = resolveDeckSize(deck)
  return (
    <li className={cx('group flex items-center gap-1 rounded-md pr-1', active ? 'bg-ed-hover' : 'hover:bg-ed-raised')}>
      <button type="button" onClick={() => select({ deckId: deck.id })} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
        {platform && <StoreBadge store={platform.store} />}
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate text-[13px]', active ? 'text-ed-text' : 'text-ed-muted')}>{platform?.name ?? deck.platformId}</span>
          <span className="block text-[10px] tabular-nums text-ed-faint">
            {size.width}×{size.height} · {deck.screens.length} screens
          </span>
        </span>
      </button>
      <Popover
        align="right"
        width={250}
        trigger={(_, toggle) => (
          <button type="button" onClick={toggle} className="ed-icon-btn size-6 opacity-0 group-hover:opacity-100" aria-label="Platform options">
            <MoreHorizontal size={14} />
          </button>
        )}
      >
        {close => <DeckMenu deck={deck} close={close} canRemove={canRemove} />}
      </Popover>
    </li>
  )
}

function DeckMenu({ deck, close, canRemove }: { deck: PlatformDeck; close: () => void; canRemove: boolean }) {
  const platform = getPlatform(deck.platformId)!
  const [custom, setCustom] = useState({ w: resolveDeckSize(deck).width, h: resolveDeckSize(deck).height })
  return (
    <div className="space-y-1">
      <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-ed-faint">Output size</div>
      {platform.sizes.map(s => (
        <MenuItem key={s.id} active={deck.sizeId === s.id} onClick={() => (A.setPlatformSize(deck.id, { sizeId: s.id }), close())}>
          <span className="flex justify-between gap-2">
            <span className="truncate">{s.label}</span>
            <span className="tabular-nums text-ed-faint">
              {s.width}×{s.height}
            </span>
          </span>
        </MenuItem>
      ))}
      <div className="flex items-center gap-1 px-2 py-1">
        <input className="ed-input h-7" aria-label="Custom width" value={custom.w} onChange={e => setCustom({ ...custom, w: Number(e.target.value) || 0 })} />
        <span className="text-ed-faint">×</span>
        <input className="ed-input h-7" aria-label="Custom height" value={custom.h} onChange={e => setCustom({ ...custom, h: Number(e.target.value) || 0 })} />
        <button
          type="button"
          className="ed-btn h-7 px-2"
          onClick={() => {
            try {
              const warnings = A.setPlatformSize(deck.id, { width: custom.w, height: custom.h })
              if (warnings.length) toast(warnings.join(' '), 'error')
              close()
            } catch (e) {
              toast((e as Error).message, 'error')
            }
          }}
        >
          Set
        </button>
      </div>
      {platform.rotatable && (
        <>
          <MenuDivider />
          <MenuItem icon={<RectangleVertical size={14} />} active={deck.orientation === 'portrait'} onClick={() => (A.setPlatformSize(deck.id, { orientation: 'portrait' }), close())}>
            Portrait
          </MenuItem>
          <MenuItem icon={<RectangleHorizontal size={14} />} active={deck.orientation === 'landscape'} onClick={() => (A.setPlatformSize(deck.id, { orientation: 'landscape' }), close())}>
            Landscape
          </MenuItem>
        </>
      )}
      <MenuDivider />
      <MenuItem icon={<Trash2 size={14} />} danger disabled={!canRemove} onClick={() => (A.removePlatform(deck.id), close())}>
        Remove platform
      </MenuItem>
    </div>
  )
}

function ScreenList({ deck, activeId, lang }: { deck: PlatformDeck; activeId: string | null; lang: string }) {
  const size = resolveDeckSize(deck)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const thumbW = size.width > size.height ? 180 : 76
  return (
    <ul className="ed-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
      {deck.screens.map((screen, i) => {
        const langs = Object.keys(screen.images)
        const headline = screen.copy.headline[lang] || Object.values(screen.copy.headline).find(Boolean) || ''
        return (
          <li
            key={screen.id}
            draggable
            onDragStart={e => {
              setDragId(screen.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={e => {
              if (!dragId) return
              e.preventDefault()
              setOverIndex(i)
            }}
            onDragEnd={() => {
              setDragId(null)
              setOverIndex(null)
            }}
            onDrop={e => {
              e.preventDefault()
              if (dragId && dragId !== screen.id) A.moveScreen(dragId, i)
              setDragId(null)
              setOverIndex(null)
            }}
            className={cx(
              'group relative flex gap-2 rounded-lg border p-1.5 transition',
              screen.id === activeId ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:bg-ed-raised',
              overIndex === i && dragId && 'border-dashed border-brand-300',
              size.width > size.height && 'flex-col',
            )}
          >
            <button type="button" className="shrink-0 overflow-hidden rounded" onClick={() => select({ screenId: screen.id })} aria-label={`Select ${screen.name}`}>
              <ScreenCanvas screen={screen} size={size} lang={lang} cssWidth={thumbW} quality={0.8} />
            </button>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-start justify-between gap-1">
                <button type="button" onClick={() => select({ screenId: screen.id })} className="min-w-0 text-left">
                  <div className="truncate text-[12px] font-medium text-ed-text">
                    <span className="mr-1 text-ed-faint">{i + 1}</span>
                    {screen.name}
                  </div>
                </button>
                <GripVertical size={13} className="mt-0.5 shrink-0 cursor-grab text-ed-faint opacity-0 group-hover:opacity-100" />
              </div>
              {headline && <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ed-muted">{headline}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-0.5">
                {langs.map(l => (
                  <span key={l} title={`${getLanguage(l).name} screenshot`} className="text-[11px]">
                    {getLanguage(l).flag}
                  </span>
                ))}
                <span className="ml-auto flex opacity-0 transition group-hover:opacity-100">
                  <button type="button" className="ed-icon-btn size-6" title="Duplicate" onClick={() => A.duplicateScreen(screen.id)} aria-label="Duplicate screen">
                    <Copy size={12} />
                  </button>
                  <button type="button" className="ed-icon-btn size-6 hover:text-red-400" title="Delete" onClick={() => A.deleteScreen(screen.id)} aria-label="Delete screen">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function AddPlatformDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCurrent()
  const [platformId, setPlatformId] = useState('google-play-phone')
  const [cloneFrom, setCloneFrom] = useState<string>('')
  const [allVariants, setAllVariants] = useState(false)
  const platform = getPlatform(platformId)
  if (!c?.variant) return null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a store platform"
      width={720}
      footer={
        <>
          <button type="button" className="ed-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ed-btn-primary"
            onClick={() => {
              A.addPlatform(platformId, { cloneFromDeckId: cloneFrom || undefined, allVariants })
              toast(`${platform?.name} added${cloneFrom ? ' — screens copied and resized' : ''}`, 'success')
              onClose()
            }}
          >
            Add {platform?.name}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_240px] gap-5">
        <div className="space-y-4">
          {STORES.map(store => (
            <div key={store.id}>
              <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ed-text">
                <StoreBadge store={store.id} /> {store.name}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PLATFORMS.filter(p => p.store === store.id).map(p => {
                  const exists = c.variant!.decks.some(d => d.platformId === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatformId(p.id)}
                      className={cx('rounded-md border px-2.5 py-2 text-left transition', platformId === p.id ? 'border-brand-500 bg-brand-500/10' : 'border-ed-border hover:bg-ed-hover')}
                    >
                      <div className="text-[12px] font-medium text-ed-text">{p.name}</div>
                      <div className="text-[10px] text-ed-faint">
                        {p.sizes[0].width}×{p.sizes[0].height}
                        {exists && ' · added'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {platform && (
          <div className="space-y-3 rounded-lg border border-ed-border bg-ed-bg p-3">
            <div>
              <div className="text-[13px] font-semibold">{getStore(platform.store).name} · {platform.name}</div>
              <div className="text-[11px] text-ed-muted">{platform.formats}</div>
            </div>
            <ul className="space-y-1.5 text-[11px] leading-4 text-ed-muted">
              {platform.requirements.map(r => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <label className="block space-y-1">
              <span className="ed-label">Start from</span>
              <select className="ed-select" value={cloneFrom} onChange={e => setCloneFrom(e.target.value)}>
                <option value="">Empty platform</option>
                {c.variant.decks.map(d => (
                  <option key={d.id} value={d.id}>
                    Copy of {getPlatform(d.platformId)?.name} ({d.screens.length} screens)
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] leading-4 text-ed-faint">Copying reuses screenshots, copy and design, rescaled to the new size.</p>
            {(c.project.variants.length ?? 0) > 1 && (
              <label className="flex items-center gap-2 text-[12px] text-ed-text">
                <input type="checkbox" checked={allVariants} onChange={e => setAllVariants(e.target.checked)} /> Add to all {c.project.variants.length} variants
              </label>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
