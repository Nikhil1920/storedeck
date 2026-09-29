import { ArrowDown, ArrowUp, Image as ImageIcon, Layers, Plus, Shapes, Smile, Trash2, Type, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as A from '~/lib/editor/actions'
import { setUi, useEditor } from '~/lib/editor/store'
import { FONT_WEIGHTS, newId } from '~/lib/model/defaults'
import { getLanguage } from '~/lib/model/languages'
import type { CanvasElement, ElementLayer, Popout, Screen, TextFrame } from '~/lib/model/types'
import { importImageBlob, ensureImage } from '~/lib/storage/assets'
import { ApplyToAll } from './Inspector'
import { EmojiPicker, FontPicker, IconPicker } from './pickers'
import { ColorField, EmptyState, Field, Section, Slider, Toggle, cx } from './ui'

const LAYERS: Array<{ value: ElementLayer; label: string }> = [
  { value: 'behind-device', label: 'Behind device' },
  { value: 'above-device', label: 'Above device' },
  { value: 'above-text', label: 'Above text' },
]

const FRAMES: Array<{ value: TextFrame; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'pill', label: 'Pill (filled)' },
  { value: 'outline-pill', label: 'Pill (outline)' },
  { value: 'laurel-simple', label: 'Laurel' },
  { value: 'laurel-simple-star', label: 'Laurel + star' },
  { value: 'laurel-detailed', label: 'Laurel detailed' },
  { value: 'laurel-detailed-star', label: 'Laurel detailed + star' },
  { value: 'badge-circle', label: 'Circle badge' },
  { value: 'badge-ribbon', label: 'Shield badge' },
]

const base = () => ({ id: newId('el'), x: 50, y: 50, rotation: 0, opacity: 100, layer: 'above-text' as const })

function elementLabel(el: CanvasElement, lang: string) {
  if (el.kind === 'text') return el.texts[lang] || Object.values(el.texts)[0] || 'Text'
  if (el.kind === 'emoji') return `${el.emoji} ${el.name}`
  if (el.kind === 'icon') return el.icon
  return el.name
}

export function ElementsPanel({ screen, lang }: { screen: Screen; lang: string }) {
  const selectedId = useEditor(s => s.ui.selectedElementId)
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = screen.elements.find(e => e.id === selectedId)
  return (
    <>
      <Section title="Add element">
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" className="ed-btn h-14 flex-col gap-1 px-1 text-[11px]" onClick={() => A.addTextElement(screen.id, 'New', lang)}>
            <Type size={16} /> Text
          </button>
          <EmojiPicker onPick={(emoji, name) => A.addElement(screen.id, { ...base(), kind: 'emoji', name, width: 12, emoji })}>
            {toggle => (
              <button type="button" className="ed-btn h-14 w-full flex-col gap-1 px-1 text-[11px]" onClick={toggle}>
                <Smile size={16} /> Emoji
              </button>
            )}
          </EmojiPicker>
          <IconPicker onPick={icon => A.addElement(screen.id, { ...base(), kind: 'icon', name: icon, width: 12, icon, color: '#ffffff', strokeWidth: 2, shadow: { enabled: false, color: '#000000', blur: 20, opacity: 40, x: 0, y: 10 } })}>
            {toggle => (
              <button type="button" className="ed-btn h-14 w-full flex-col gap-1 px-1 text-[11px]" onClick={toggle}>
                <Shapes size={16} /> Icon
              </button>
            )}
          </IconPicker>
          <button type="button" className="ed-btn h-14 flex-col gap-1 px-1 text-[11px]" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={16} /> Image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async e => {
              const f = e.target.files?.[0]
              if (!f) return
              const ref = await importImageBlob(f, f.name)
              A.addElement(screen.id, { ...base(), kind: 'image', name: f.name.replace(/\.[^.]+$/, ''), width: 25, assetId: ref.assetId })
              e.target.value = ''
            }}
          />
        </div>
      </Section>
      <Section title={`Layers (${screen.elements.length})`}>
        {screen.elements.length === 0 ? (
          <EmptyState icon={<Layers size={22} />} title="No elements">
            Award badges, ratings, icons and logos sit on top of the design.
          </EmptyState>
        ) : (
          <ul className="space-y-1">
            {[...screen.elements].reverse().map(el => {
              const i = screen.elements.indexOf(el)
              return (
                <li key={el.id} className={cx('flex items-center gap-1 rounded-md border px-2 py-1', el.id === selectedId ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:bg-ed-hover')}>
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-[12px] text-ed-text" onClick={() => setUi({ selectedElementId: el.id })}>
                    <span className="mr-1.5 text-ed-faint">{el.kind}</span>
                    {elementLabel(el, lang)}
                  </button>
                  <button type="button" className="ed-icon-btn size-6" disabled={i === screen.elements.length - 1} onClick={() => A.reorderElement(screen.id, el.id, i + 1)} aria-label="Bring forward">
                    <ArrowUp size={12} />
                  </button>
                  <button type="button" className="ed-icon-btn size-6" disabled={i === 0} onClick={() => A.reorderElement(screen.id, el.id, i - 1)} aria-label="Send backward">
                    <ArrowDown size={12} />
                  </button>
                  <button type="button" className="ed-icon-btn size-6 hover:text-red-400" onClick={() => A.deleteElement(screen.id, el.id)} aria-label="Delete element">
                    <Trash2 size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      {selected && <ElementProperties key={selected.id} screen={screen} el={selected} lang={lang} />}
      {screen.elements.length > 0 && <ApplyToAll screen={screen} part="elements" label="Elements" />}
    </>
  )
}

function ElementProperties({ screen, el, lang }: { screen: Screen; el: CanvasElement; lang: string }) {
  const set = (patch: Record<string, unknown>, key?: string) => A.updateElement(screen.id, el.id, patch, key ? `${el.id}:${key}` : undefined)
  return (
    <Section title="Selected element">
      {el.kind === 'text' && (
        <>
          <Field label={`Text · ${getLanguage(lang).flag} ${lang}`}>
            <textarea
              className="ed-input h-auto min-h-[52px] py-1.5"
              value={el.texts[lang] ?? ''}
              placeholder={Object.values(el.texts).find(Boolean) ?? ''}
              onChange={e => A.setCopy([{ screenId: screen.id, field: `element:${el.id}`, language: lang, text: e.target.value }], `${el.id}:text:${lang}`)}
            />
          </Field>
          <Field label="Font">
            <FontPicker value={el.font} onChange={font => set({ font })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <select className="ed-select" value={el.fontWeight} onChange={e => set({ fontWeight: e.target.value })} aria-label="Weight">
              {FONT_WEIGHTS.map(w => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            <Toggle label="Italic" checked={el.italic} onChange={v => set({ italic: v })} />
          </div>
          <Slider label="Font size" value={el.fontSize} min={8} max={400} unit="px" onChange={v => set({ fontSize: v }, 'fs')} />
          <ColorField label="Text" value={el.color} onChange={v => set({ color: v }, 'color')} />
          <Field label="Frame">
            <select className="ed-select" value={el.frame} onChange={e => set({ frame: e.target.value })}>
              {FRAMES.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          {el.frame !== 'none' && (
            <>
              <ColorField label="Frame" value={el.frameColor} onChange={v => set({ frameColor: v }, 'fc')} />
              <Slider label="Frame size" value={el.frameScale} min={40} max={250} unit="%" defaultValue={100} onChange={v => set({ frameScale: v }, 'fsc')} />
            </>
          )}
        </>
      )}
      {el.kind === 'icon' && (
        <>
          <ColorField label="Icon" value={el.color} onChange={v => set({ color: v }, 'ic')} />
          <Slider label="Stroke" value={el.strokeWidth} min={0.5} max={4} step={0.25} defaultValue={2} onChange={v => set({ strokeWidth: v }, 'sw')} />
          <Toggle label="Shadow" checked={el.shadow.enabled} onChange={v => set({ shadow: { enabled: v } })} />
          {el.shadow.enabled && <Slider label="Shadow blur" value={el.shadow.blur} min={0} max={100} onChange={v => set({ shadow: { blur: v } }, 'shb')} />}
        </>
      )}
      {el.kind === 'emoji' && (
        <EmojiPicker onPick={(emoji, name) => set({ emoji, name })}>
          {toggle => (
            <button type="button" className="ed-btn w-full" onClick={toggle}>
              <span className="text-lg">{el.emoji}</span> Change emoji
            </button>
          )}
        </EmojiPicker>
      )}
      <Slider label="X" value={el.x} min={-20} max={120} unit="%" defaultValue={50} onChange={v => set({ x: v }, 'x')} />
      <Slider label="Y" value={el.y} min={-20} max={120} unit="%" defaultValue={50} onChange={v => set({ y: v }, 'y')} />
      <Slider label="Width" value={el.width} min={2} max={150} unit="%" onChange={v => set({ width: v }, 'w')} />
      <Slider label="Rotation" value={el.rotation} min={-180} max={180} unit="°" defaultValue={0} onChange={v => set({ rotation: v }, 'r')} />
      <Slider label="Opacity" value={el.opacity} min={0} max={100} unit="%" defaultValue={100} onChange={v => set({ opacity: v }, 'o')} />
      <Field label="Layer">
        <select className="ed-select" value={el.layer} onChange={e => set({ layer: e.target.value })}>
          {LAYERS.map(l => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
    </Section>
  )
}

// ---------------------------------------------------------------- popouts

export function PopoutsPanel({ screen }: { screen: Screen }) {
  const selectedId = useEditor(s => s.ui.selectedPopoutId)
  const selected = screen.popouts.find(p => p.id === selectedId)
  const hasImage = Object.keys(screen.images).length > 0
  return (
    <>
      <Section title="Popouts">
        <p className="text-[12px] leading-5 text-ed-muted">Magnify part of the screenshot — a feature, a button, a chart — as a floating callout.</p>
        <button type="button" className="ed-btn w-full" disabled={!hasImage} onClick={() => A.addPopout(screen.id)}>
          <Plus size={14} /> Add popout
        </button>
        {screen.popouts.length === 0 ? (
          <EmptyState icon={<ZoomIn size={22} />} title="No popouts yet" />
        ) : (
          <ul className="space-y-1">
            {screen.popouts.map((p, i) => (
              <li key={p.id} className={cx('flex items-center gap-1 rounded-md border px-2 py-1', p.id === selectedId ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:bg-ed-hover')}>
                <button type="button" className="flex-1 text-left text-[12px]" onClick={() => setUi({ selectedPopoutId: p.id })}>
                  Popout {i + 1}
                </button>
                <button type="button" className="ed-icon-btn size-6 hover:text-red-400" onClick={() => A.deletePopout(screen.id, p.id)} aria-label="Delete popout">
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {selected && <PopoutProperties key={selected.id} screen={screen} p={selected} />}
    </>
  )
}

function CropPreview({ screen, p }: { screen: Screen; p: Popout }) {
  const ref = Object.values(screen.images)[0]
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (ref) void ensureImage(ref.assetId).then(img => setSrc(img.src))
  }, [ref])
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)
  if (!ref || !src) return null
  return (
    <div
      ref={box}
      className="relative mx-auto touch-none select-none overflow-hidden rounded-md ring-1 ring-ed-border"
      style={{ width: 150, aspectRatio: `${ref.width} / ${ref.height}` }}
      onPointerDown={e => {
        drag.current = { x: e.clientX, y: e.clientY, cx: p.cropX, cy: p.cropY }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        const d = drag.current
        const r = box.current?.getBoundingClientRect()
        if (!d || !r) return
        const nx = Math.max(0, Math.min(100 - p.cropWidth, d.cx + ((e.clientX - d.x) / r.width) * 100))
        const ny = Math.max(0, Math.min(100 - p.cropHeight, d.cy + ((e.clientY - d.y) / r.height) * 100))
        A.updatePopout(screen.id, p.id, { cropX: Math.round(nx * 10) / 10, cropY: Math.round(ny * 10) / 10 }, `${p.id}:crop`)
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <img src={src} alt="" className="pointer-events-none size-full opacity-60" draggable={false} />
      <div className="pointer-events-none absolute border-2 border-brand-400 bg-brand-400/15" style={{ left: `${p.cropX}%`, top: `${p.cropY}%`, width: `${p.cropWidth}%`, height: `${p.cropHeight}%` }} />
    </div>
  )
}

function PopoutProperties({ screen, p }: { screen: Screen; p: Popout }) {
  const set = (patch: Record<string, unknown>, key?: string) => A.updatePopout(screen.id, p.id, patch, key ? `${p.id}:${key}` : undefined)
  return (
    <>
      <Section title="Crop region">
        <CropPreview screen={screen} p={p} />
        <p className="text-center text-[11px] text-ed-faint">Drag the box to choose what to magnify.</p>
        <Slider label="Crop width" value={p.cropWidth} min={2} max={100} unit="%" onChange={v => set({ cropWidth: v }, 'cw')} />
        <Slider label="Crop height" value={p.cropHeight} min={2} max={100} unit="%" onChange={v => set({ cropHeight: v }, 'ch')} />
      </Section>
      <Section title="Placement">
        <Slider label="X" value={p.x} min={-20} max={120} unit="%" onChange={v => set({ x: v }, 'x')} />
        <Slider label="Y" value={p.y} min={-20} max={120} unit="%" onChange={v => set({ y: v }, 'y')} />
        <Slider label="Width" value={p.width} min={5} max={120} unit="%" onChange={v => set({ width: v }, 'w')} />
        <Slider label="Rotation" value={p.rotation} min={-45} max={45} unit="°" defaultValue={0} onChange={v => set({ rotation: v }, 'r')} />
        <Slider label="Corner radius" value={p.cornerRadius} min={0} max={100} defaultValue={12} onChange={v => set({ cornerRadius: v }, 'cr')} />
        <Slider label="Opacity" value={p.opacity} min={0} max={100} unit="%" defaultValue={100} onChange={v => set({ opacity: v }, 'o')} />
      </Section>
      <Section title="Border & shadow">
        <Toggle label="Border" checked={p.border.enabled} onChange={v => set({ border: { enabled: v } })} />
        {p.border.enabled && (
          <>
            <ColorField value={p.border.color} onChange={v => set({ border: { color: v } }, 'bc')} />
            <Slider label="Border width" value={p.border.width} min={1} max={30} onChange={v => set({ border: { width: v } }, 'bw')} />
          </>
        )}
        <Toggle label="Shadow" checked={p.shadow.enabled} onChange={v => set({ shadow: { enabled: v } })} />
        {p.shadow.enabled && <Slider label="Shadow blur" value={p.shadow.blur} min={0} max={120} onChange={v => set({ shadow: { blur: v } }, 'sb')} />}
      </Section>
    </>
  )
}
