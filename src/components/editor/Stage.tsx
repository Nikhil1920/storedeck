import { ChevronLeft, ChevronRight, ImagePlus, Upload } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as A from '~/lib/editor/actions'
import { getState, select, setUi, useEditor } from '~/lib/editor/store'
import { fallbackChain, screenImage } from '~/lib/model/ops'
import { getPlatform, resolveDeckSize } from '~/lib/model/platforms'
import type { CanvasElement, Screen } from '~/lib/model/types'
import { deviceRect, elementBounds } from '~/lib/render/canvas'
import { getImage } from '~/lib/storage/assets'
import { ScreenCanvas, useCurrent } from './ScreenCanvas'
import { cx } from './ui'

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

type Drag =
  | { kind: 'element'; id: string; x0: number; y0: number; px: number; py: number }
  | { kind: 'popout'; id: string; x0: number; y0: number; px: number; py: number }
  | { kind: 'device'; x0: number; y0: number; px: number; py: number; moveX: number; moveY: number }
  | { kind: 'rotate'; rx: number; ry: number; px: number; py: number }

const LAYER_ORDER: CanvasElement['layer'][] = ['above-text', 'above-device', 'behind-device']

export function Stage({ onUploadClick }: { onUploadClick: () => void }) {
  const c = useCurrent()
  const [boxRef, box] = useElementSize<HTMLDivElement>()
  return (
    <div ref={boxRef} className="checker relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      {c?.deck && box.width > 0 && <StageContent box={box} onUploadClick={onUploadClick} />}
    </div>
  )
}

function StageContent({ box, onUploadClick }: { box: { width: number; height: number }; onUploadClick: () => void }) {
  const c = useCurrent()!
  const deck = c.deck!
  const size = resolveDeckSize(deck)
  const screen = c.screen
  const idx = c.screenIndex
  const prev = idx > 0 ? deck.screens[idx - 1] : null
  const next = idx >= 0 && idx < deck.screens.length - 1 ? deck.screens[idx + 1] : null

  // Fit the main canvas; side previews use what is left.
  const aspect = size.width / size.height
  const availH = Math.max(120, box.height - 64)
  const availW = Math.max(120, box.width - 48)
  let cssH = availH
  let cssW = cssH * aspect
  const maxMainW = availW * (aspect > 1 ? 0.8 : 0.56)
  if (cssW > maxMainW) {
    cssW = maxMainW
    cssH = cssW / aspect
  }
  const sideW = Math.min(cssW * 0.62, (availW - cssW) / 2 - 24)

  if (!deck.screens.length) return <EmptyDeck onUploadClick={onUploadClick} platformId={deck.platformId} />
  if (!screen) return null
  return (
    <>
      {prev && sideW > 40 && <SidePreview screen={prev} size={size} lang={c.lang} cssWidth={sideW} side="left" onClick={() => select({ screenId: prev.id })} />}
      <MainCanvas screen={screen} size={size} lang={c.lang} cssWidth={cssW} platformId={deck.platformId} />
      {next && sideW > 40 && <SidePreview screen={next} size={size} lang={c.lang} cssWidth={sideW} side="right" onClick={() => select({ screenId: next.id })} />}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-ed-border bg-ed-panel/90 px-1 py-0.5 text-[12px] text-ed-muted shadow-lg backdrop-blur">
        <button className="ed-icon-btn size-7" disabled={!prev} onClick={() => prev && select({ screenId: prev.id })} aria-label="Previous screen">
          <ChevronLeft size={15} />
        </button>
        <span className="min-w-14 text-center tabular-nums">
          {idx + 1} / {deck.screens.length}
        </span>
        <button className="ed-icon-btn size-7" disabled={!next} onClick={() => next && select({ screenId: next.id })} aria-label="Next screen">
          <ChevronRight size={15} />
        </button>
      </div>
    </>
  )
}

function SidePreview({ screen, size, lang, cssWidth, side, onClick }: { screen: Screen; size: { width: number; height: number }; lang: string; cssWidth: number; side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={screen.name}
      className={cx('absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md opacity-45 shadow-xl transition hover:opacity-80', side === 'left' ? 'left-6' : 'right-6')}
    >
      <ScreenCanvas screen={screen} size={size} lang={lang} cssWidth={cssWidth} quality={0.6} />
    </button>
  )
}

function EmptyDeck({ onUploadClick, platformId }: { onUploadClick: () => void; platformId: string }) {
  const platform = getPlatform(platformId)
  return (
    <button
      type="button"
      onClick={onUploadClick}
      className="flex max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ed-border bg-ed-panel/80 px-10 py-12 text-center transition hover:border-brand-500"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
        <Upload size={26} />
      </div>
      <div className="text-[15px] font-semibold text-ed-text">Drop {platform?.name ?? ''} screenshots here</div>
      <p className="text-[13px] leading-5 text-ed-muted">
        PNG or JPEG straight from the simulator or device. Name localized files like <code className="rounded bg-ed-raised px-1">home_de.png</code> and they group automatically.
      </p>
      <span className="ed-btn-primary mt-1">
        <ImagePlus size={15} /> Choose files
      </span>
    </button>
  )
}

function MainCanvas({ screen, size, lang, cssWidth, platformId }: { screen: Screen; size: { width: number; height: number }; lang: string; cssWidth: number; platformId: string }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const selectedElementId = useEditor(s => s.ui.selectedElementId)
  const selectedPopoutId = useEditor(s => s.ui.selectedPopoutId)
  const showSafeArea = useEditor(s => s.ui.showSafeArea)
  const languages = useEditor(s => s.project!.languages)
  const defaultLanguage = useEditor(s => s.project!.defaultLanguage)
  const assetsVersion = useEditor(s => s.assetsVersion)
  const k = cssWidth / size.width
  const cssHeight = size.height * k
  const chain = fallbackChain({ languages, defaultLanguage }, lang)
  const [cursor, setCursor] = useState('default')

  const toOutput = (e: ReactPointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
  }

  const imgRef = screenImage(screen, chain)
  const aspect = imgRef ? imgRef.height / imgRef.width : size.height / size.width
  const dRect = deviceRect(aspect, size.width, size.height, screen.device)

  const hitElement = (pt: { x: number; y: number }) => {
    for (const layer of LAYER_ORDER) {
      for (const el of [...screen.elements].reverse()) {
        if (el.layer !== layer) continue
        const b = elementBounds(el, size.width, size.height, el.kind === 'image' ? getImage(el.assetId) : undefined)
        if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return el
      }
    }
    return null
  }
  const hitPopout = (pt: { x: number; y: number }) => {
    for (const p of [...screen.popouts].reverse()) {
      const w = size.width * (p.width / 100)
      const h = w * (p.cropHeight / p.cropWidth) * (imgRef ? imgRef.height / imgRef.width : 1)
      const cx = size.width * (p.x / 100)
      const cy = size.height * (p.y / 100)
      if (Math.abs(pt.x - cx) <= w / 2 && Math.abs(pt.y - cy) <= h / 2) return p
    }
    return null
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const pt = toOutput(e)
    const el = hitElement(pt)
    if (el) {
      setUi({ selectedElementId: el.id, selectedPopoutId: null, inspectorTab: 'elements' })
      drag.current = { kind: 'element', id: el.id, x0: el.x, y0: el.y, px: pt.x, py: pt.y }
    } else {
      const p = hitPopout(pt)
      if (p) {
        setUi({ selectedPopoutId: p.id, selectedElementId: null, inspectorTab: 'popouts' })
        drag.current = { kind: 'popout', id: p.id, x0: p.x, y0: p.y, px: pt.x, py: pt.y }
      } else if (screen.device.use3D && !e.altKey) {
        drag.current = { kind: 'rotate', rx: screen.device.rotation3D.x, ry: screen.device.rotation3D.y, px: pt.x, py: pt.y }
      } else if (e.altKey || (pt.x >= dRect.x && pt.x <= dRect.x + dRect.w && pt.y >= dRect.y && pt.y <= dRect.y + dRect.h)) {
        drag.current = {
          kind: 'device',
          x0: screen.device.x,
          y0: screen.device.y,
          px: pt.x,
          py: pt.y,
          moveX: Math.max(size.width - dRect.w, size.width * 0.15),
          moveY: Math.max(size.height - dRect.h, size.height * 0.15),
        }
      } else {
        setUi({ selectedElementId: null, selectedPopoutId: null })
        return
      }
    }
    overlayRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const pt = toOutput(e)
    if (!d) {
      setCursor(hitElement(pt) || hitPopout(pt) ? 'move' : screen.device.use3D ? 'grab' : pt.x >= dRect.x && pt.x <= dRect.x + dRect.w && pt.y >= dRect.y && pt.y <= dRect.y + dRect.h ? 'move' : 'default')
      return
    }
    const dx = pt.x - d.px
    const dy = pt.y - d.py
    const snap = (v: number) => (Math.abs(v - 50) < 1 ? 50 : Math.round(v * 10) / 10)
    if (d.kind === 'element') {
      A.updateElement(screen.id, d.id, { x: snap(d.x0 + (dx / size.width) * 100), y: snap(d.y0 + (dy / size.height) * 100) }, `drag:${d.id}`)
    } else if (d.kind === 'popout') {
      A.updatePopout(screen.id, d.id, { x: snap(d.x0 + (dx / size.width) * 100), y: snap(d.y0 + (dy / size.height) * 100) }, `drag:${d.id}`)
    } else if (d.kind === 'device') {
      A.setDevice([screen.id], { x: snap(d.x0 + (dx / d.moveX) * 100), y: snap(d.y0 + (dy / d.moveY) * 100) }, undefined, `drag:device:${screen.id}`)
    } else if (d.kind === 'rotate') {
      const clamp = (v: number) => Math.round(Math.max(-60, Math.min(60, v)) * 10) / 10
      A.setDevice([screen.id], { rotation3D: { x: clamp(d.rx + dy * k * 0.4), y: clamp(d.ry + dx * k * 0.4) } }, undefined, `drag:rot:${screen.id}`)
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    drag.current = null
    overlayRef.current?.releasePointerCapture(e.pointerId)
  }

  // Keyboard nudging for the selected element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      const id = getState().ui.selectedElementId
      if (!id) return
      const el = screen.elements.find(x => x.id === id)
      if (!el) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        A.deleteElement(screen.id, id)
        return
      }
      const step = e.shiftKey ? 5 : 0.5
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (!delta) return
      e.preventDefault()
      e.stopPropagation()
      A.updateElement(screen.id, id, { x: el.x + delta[0], y: el.y + delta[1] }, `nudge:${id}`)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [screen])

  const selected = screen.elements.find(e => e.id === selectedElementId)
  const selBox = selected ? elementBounds(selected, size.width, size.height, selected.kind === 'image' ? getImage(selected.assetId) : undefined) : null
  const selectedPopout = screen.popouts.find(p => p.id === selectedPopoutId)
  const popBox = selectedPopout
    ? (() => {
        const w = size.width * (selectedPopout.width / 100)
        const h = w * (selectedPopout.cropHeight / selectedPopout.cropWidth) * (imgRef ? imgRef.height / imgRef.width : 1)
        return { x: size.width * (selectedPopout.x / 100) - w / 2, y: size.height * (selectedPopout.y / 100) - h / 2, w, h }
      })()
    : null
  void assetsVersion
  const msBottomThird = platformId.startsWith('ms-store')

  return (
    <div className="relative shadow-2xl shadow-black/60" style={{ width: cssWidth, height: cssHeight }}>
      <ScreenCanvas screen={screen} size={size} lang={lang} cssWidth={cssWidth} className="rounded-[2px]" />
      <div
        ref={overlayRef}
        className="absolute inset-0 touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={() => (drag.current = null)}
      >
        {selBox && <div className="pointer-events-none absolute rounded-sm border-2 border-brand-400 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" style={{ left: selBox.x * k, top: selBox.y * k, width: selBox.w * k, height: selBox.h * k }} />}
        {popBox && <div className="pointer-events-none absolute rounded-sm border-2 border-dashed border-brand-400" style={{ left: popBox.x * k, top: popBox.y * k, width: popBox.w * k, height: popBox.h * k }} />}
        {showSafeArea && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-[6%] border border-dashed border-cyan-300/70" />
            <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-cyan-300/40" />
            <div className="absolute right-0 left-0 top-1/2 border-t border-dashed border-cyan-300/40" />
            {msBottomThird && (
              <div className="absolute right-0 bottom-0 left-0 h-1/3 bg-cyan-400/15">
                <span className="absolute top-1 left-2 text-[10px] text-cyan-100">Store may overlay this third</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
