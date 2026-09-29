import { Box, Copy, Image as ImageIcon, Layers, Smartphone, Sparkles, Trash2, Type, ZoomIn } from 'lucide-react'
import { useRef } from 'react'
import * as A from '~/lib/editor/actions'
import { setUi, toast, useEditor, type InspectorTab } from '~/lib/editor/store'
import { GRADIENT_PRESETS, POSITION_PRESETS, type PositionPresetId } from '~/lib/model/defaults'
import type { DeepPartial } from '~/lib/model/ops'
import { getPlatform } from '~/lib/model/platforms'
import type { Background, ChromeStyle, DeviceSettings, Screen } from '~/lib/model/types'
import { MODEL_COLOR_PRESETS } from '~/lib/render/three-presets'
import { importImageBlob } from '~/lib/storage/assets'
import { ElementsPanel, PopoutsPanel } from './ElementsPanel'
import { useCurrent } from './ScreenCanvas'
import { TextPanel } from './TextPanel'
import { ColorField, EmptyState, Field, Section, Segmented, Slider, Toggle, cx } from './ui'

const TABS: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
  { id: 'background', label: 'Background', icon: <Sparkles size={14} /> },
  { id: 'device', label: 'Device', icon: <Smartphone size={14} /> },
  { id: 'text', label: 'Text', icon: <Type size={14} /> },
  { id: 'elements', label: 'Elements', icon: <Layers size={14} /> },
  { id: 'popouts', label: 'Popouts', icon: <ZoomIn size={14} /> },
]

export function Inspector() {
  const tab = useEditor(s => s.ui.inspectorTab)
  const c = useCurrent()
  const screen = c?.screen
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-ed-border bg-ed-panel">
      <div className="grid grid-cols-5 border-b border-ed-border" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setUi({ inspectorTab: t.id })}
            className={cx('flex flex-col items-center gap-1 border-b-2 py-2 text-[10px] font-medium transition', tab === t.id ? 'border-brand-500 text-ed-text' : 'border-transparent text-ed-faint hover:text-ed-muted')}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="ed-scroll min-h-0 flex-1 overflow-y-auto">
        {!screen ? (
          <EmptyState icon={<Box size={28} />} title="No screen selected">
            Upload screenshots or add a blank screen to start designing.
          </EmptyState>
        ) : tab === 'background' ? (
          <BackgroundPanel screen={screen} />
        ) : tab === 'device' ? (
          <DevicePanel screen={screen} platformId={c!.deck!.platformId} />
        ) : tab === 'text' ? (
          <TextPanel screen={screen} lang={c!.lang} />
        ) : tab === 'elements' ? (
          <ElementsPanel screen={screen} lang={c!.lang} />
        ) : (
          <PopoutsPanel screen={screen} />
        )}
      </div>
    </aside>
  )
}

export function ApplyToAll({ screen, part, label }: { screen: Screen; part: 'background' | 'device' | 'text' | 'elements'; label: string }) {
  const c = useCurrent()
  return (
    <div className="px-4 py-4">
      <button
        type="button"
        className="ed-btn w-full"
        onClick={() => {
          const targets = c?.deck?.screens.map(s => s.id).filter(id => id !== screen.id) ?? []
          if (!targets.length) return toast('This is the only screen in the platform')
          A.transferStyle(screen.id, targets, { background: part === 'background', device: part === 'device', text: part === 'text', elements: part === 'elements' })
          toast(`${label} applied to ${targets.length} screen${targets.length > 1 ? 's' : ''}`, 'success')
        }}
      >
        <Copy size={13} /> Apply {label.toLowerCase()} to all screens
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- background

function BackgroundPanel({ screen }: { screen: Screen }) {
  const bg = screen.background
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: DeepPartial<Background>, key?: string) => A.setBackground([screen.id], patch, key ? `${screen.id}:bg:${key}` : undefined)
  const stops = bg.gradient.stops
  const css = `linear-gradient(${bg.gradient.angle}deg, ${stops.map(s => `${s.color} ${s.position}%`).join(', ')})`
  return (
    <>
      <Section title="Fill">
        <Segmented
          value={bg.type}
          onChange={type => set({ type })}
          options={[
            { value: 'gradient', label: 'Gradient' },
            { value: 'solid', label: 'Solid' },
            { value: 'image', label: 'Image' },
          ]}
        />
        {bg.type === 'gradient' && (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {GRADIENT_PRESETS.map(g => (
                <button
                  key={g.name}
                  type="button"
                  title={g.name}
                  onClick={() => set({ gradient: { angle: g.angle, stops: g.stops } })}
                  className="aspect-square rounded-md ring-1 ring-white/10 transition hover:scale-110"
                  style={{ background: `linear-gradient(${g.angle}deg, ${g.stops.map(s => `${s.color} ${s.position}%`).join(', ')})` }}
                />
              ))}
            </div>
            <div className="h-6 rounded-md ring-1 ring-white/10" style={{ background: bg.gradient.kind === 'radial' ? `radial-gradient(circle, ${stops.map(s => `${s.color} ${s.position}%`).join(', ')})` : css }} />
            <Segmented
              size="sm"
              value={bg.gradient.kind}
              onChange={kind => set({ gradient: { kind } })}
              options={[
                { value: 'linear', label: 'Linear' },
                { value: 'radial', label: 'Radial' },
              ]}
            />
            {bg.gradient.kind === 'linear' && <Slider label="Angle" value={bg.gradient.angle} min={0} max={360} unit="°" defaultValue={135} onChange={v => set({ gradient: { angle: v } }, 'angle')} />}
            <div className="space-y-2">
              {stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    className="ed-color"
                    value={stop.color}
                    aria-label={`Stop ${i + 1} color`}
                    onChange={e => set({ gradient: { stops: stops.map((s, j) => (j === i ? { ...s, color: e.target.value } : s)) } }, `stop${i}`)}
                  />
                  <input
                    type="range"
                    className="ed-range flex-1"
                    min={0}
                    max={100}
                    value={stop.position}
                    aria-label={`Stop ${i + 1} position`}
                    onChange={e => set({ gradient: { stops: stops.map((s, j) => (j === i ? { ...s, position: Number(e.target.value) } : s)) } }, `stoppos${i}`)}
                  />
                  <span className="w-8 text-right text-[11px] tabular-nums text-ed-muted">{stop.position}%</span>
                  <button type="button" className="ed-icon-btn size-6" disabled={stops.length <= 2} onClick={() => set({ gradient: { stops: stops.filter((_, j) => j !== i) } })} aria-label="Remove stop">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {stops.length < 8 && (
                <button type="button" className="text-[12px] text-brand-300 hover:underline" onClick={() => set({ gradient: { stops: [...stops, { color: stops[stops.length - 1].color, position: 100 }] } })}>
                  + Add color stop
                </button>
              )}
            </div>
          </>
        )}
        {bg.type === 'solid' && <ColorField value={bg.solid} onChange={v => set({ solid: v }, 'solid')} />}
        {bg.type === 'image' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async e => {
                const f = e.target.files?.[0]
                if (!f) return
                const ref = await importImageBlob(f, f.name)
                set({ imageAssetId: ref.assetId, type: 'image' })
                e.target.value = ''
              }}
            />
            <button type="button" className="ed-btn w-full" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={14} /> {bg.imageAssetId ? 'Replace image' : 'Upload image'}
            </button>
            <Field label="Fit">
              <select className="ed-select" value={bg.imageFit} onChange={e => set({ imageFit: e.target.value as Background['imageFit'] })}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="stretch">Stretch</option>
              </select>
            </Field>
            <Slider label="Blur" value={bg.imageBlur} min={0} max={60} unit="px" defaultValue={0} onChange={v => set({ imageBlur: v }, 'blur')} />
          </>
        )}
      </Section>
      <Section title="Overlay tint" defaultOpen={bg.overlayOpacity > 0}>
        <ColorField value={bg.overlayColor} onChange={v => set({ overlayColor: v }, 'overlay')} />
        <Slider label="Opacity" value={bg.overlayOpacity} min={0} max={100} unit="%" defaultValue={0} onChange={v => set({ overlayOpacity: v }, 'overlayop')} />
      </Section>
      <Section title="Noise" defaultOpen={bg.noise}>
        <Toggle label="Film grain" checked={bg.noise} onChange={v => set({ noise: v })} />
        {bg.noise && <Slider label="Intensity" value={bg.noiseIntensity} min={0} max={100} unit="%" defaultValue={10} onChange={v => set({ noiseIntensity: v }, 'noise')} />}
      </Section>
      <ApplyToAll screen={screen} part="background" label="Background" />
    </>
  )
}

// ---------------------------------------------------------------- device

const CHROME_OPTIONS: Array<{ value: ChromeStyle; label: string }> = [
  { value: 'none', label: 'None (screenshot only)' },
  { value: 'phone', label: 'Phone' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'watch', label: 'Watch' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'window', label: 'App window' },
  { value: 'browser', label: 'Browser window' },
  { value: 'tv', label: 'TV' },
]

const CHROME_COLORS = ['#1d1d1f', '#3a3a3c', '#e3e3e6', '#f5f5f7', '#2b3a55', '#5b4a6e', '#c4a882', '#9d927f']

function DevicePanel({ screen, platformId }: { screen: Screen; platformId: string }) {
  const d = screen.device
  const platform = getPlatform(platformId)
  const set = (patch: DeepPartial<DeviceSettings>, key?: string) => A.setDevice([screen.id], patch, undefined, key ? `${screen.id}:dev:${key}` : undefined)
  const allow3D = platform?.category === 'phone'
  return (
    <>
      {allow3D && (
        <Section title="Mode">
          <Segmented
            value={d.use3D ? '3d' : '2d'}
            onChange={v => set({ use3D: v === '3d' })}
            options={[
              { value: '2d', label: '2D frame' },
              { value: '3d', label: '3D model' },
            ]}
          />
        </Section>
      )}
      <Section title="Layout presets">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(POSITION_PRESETS) as PositionPresetId[]).map(id => (
            <button
              key={id}
              type="button"
              className="ed-btn h-7 justify-start px-2 text-[11px]"
              onClick={() => {
                A.setDevice([screen.id], {}, id)
                const t = POSITION_PRESETS[id].text
                if (t) A.setTextStyle([screen.id], t)
              }}
            >
              {POSITION_PRESETS[id].label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Size & position">
        <Slider label="Scale" value={d.scale} min={10} max={150} unit="%" defaultValue={70} onChange={v => set({ scale: v }, 'scale')} />
        <Slider label="Horizontal" value={d.x} min={-100} max={200} unit="%" defaultValue={50} onChange={v => set({ x: v }, 'x')} />
        <Slider label="Vertical" value={d.y} min={-100} max={200} unit="%" defaultValue={60} onChange={v => set({ y: v }, 'y')} />
        <Slider label="Rotation" value={d.rotation} min={-45} max={45} unit="°" defaultValue={0} onChange={v => set({ rotation: v }, 'rot')} />
        {!d.use3D && (
          <>
            <Slider label="Perspective" value={d.perspective} min={-50} max={50} defaultValue={0} onChange={v => set({ perspective: v }, 'persp')} />
            <Slider label="Corner radius" value={d.cornerRadius} min={0} max={120} defaultValue={24} onChange={v => set({ cornerRadius: v }, 'radius')} />
          </>
        )}
      </Section>
      {d.use3D ? (
        <Section title="3D device">
          <Segmented
            value={d.model3D}
            onChange={m => set({ model3D: m, modelColor: MODEL_COLOR_PRESETS[m][0].id })}
            options={[
              { value: 'iphone', label: 'iPhone 15 Pro Max' },
              { value: 'samsung', label: 'Galaxy S25 Ultra' },
            ]}
          />
          <Field label="Finish">
            <div className="flex flex-wrap gap-1.5">
              {MODEL_COLOR_PRESETS[d.model3D].map(p => (
                <button key={p.id} type="button" title={p.label} onClick={() => set({ modelColor: p.id })} className={cx('size-7 rounded-full ring-2 transition', d.modelColor === p.id ? 'ring-brand-400' : 'ring-transparent hover:ring-ed-border')} style={{ background: p.swatch }} />
              ))}
            </div>
          </Field>
          <Slider label="Tilt (X)" value={d.rotation3D.x} min={-60} max={60} unit="°" defaultValue={0} onChange={v => set({ rotation3D: { x: v } }, 'r3x')} />
          <Slider label="Turn (Y)" value={d.rotation3D.y} min={-60} max={60} unit="°" defaultValue={0} onChange={v => set({ rotation3D: { y: v } }, 'r3y')} />
          <Slider label="Roll (Z)" value={d.rotation3D.z} min={-60} max={60} unit="°" defaultValue={0} onChange={v => set({ rotation3D: { z: v } }, 'r3z')} />
          <p className="text-[11px] text-ed-faint">Drag the canvas to rotate · Alt-drag to move.</p>
        </Section>
      ) : (
        <Section title="Device frame">
          <Field label="Frame">
            <select className="ed-select" value={d.chrome.style} onChange={e => set({ chrome: { style: e.target.value as ChromeStyle } })}>
              {CHROME_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          {d.chrome.style !== 'none' && (
            <Field label="Frame color">
              <div className="mb-2 flex gap-1.5">
                {CHROME_COLORS.map(col => (
                  <button key={col} type="button" onClick={() => set({ chrome: { color: col } })} className={cx('size-6 rounded-full ring-2', d.chrome.color === col ? 'ring-brand-400' : 'ring-white/10')} style={{ background: col }} aria-label={col} />
                ))}
              </div>
              <ColorField value={d.chrome.color} onChange={v => set({ chrome: { color: v } }, 'chromecolor')} />
            </Field>
          )}
        </Section>
      )}
      <Section title="Shadow" defaultOpen={d.shadow.enabled}>
        <Toggle label="Drop shadow" checked={d.shadow.enabled} onChange={v => set({ shadow: { enabled: v } })} />
        {d.shadow.enabled && (
          <>
            <ColorField value={d.shadow.color} onChange={v => set({ shadow: { color: v } }, 'shc')} />
            <Slider label="Blur" value={d.shadow.blur} min={0} max={200} defaultValue={40} onChange={v => set({ shadow: { blur: v } }, 'shb')} />
            <Slider label="Opacity" value={d.shadow.opacity} min={0} max={100} unit="%" defaultValue={30} onChange={v => set({ shadow: { opacity: v } }, 'sho')} />
            <Slider label="Offset X" value={d.shadow.x} min={-100} max={100} defaultValue={0} onChange={v => set({ shadow: { x: v } }, 'shx')} />
            <Slider label="Offset Y" value={d.shadow.y} min={-100} max={200} defaultValue={20} onChange={v => set({ shadow: { y: v } }, 'shy')} />
          </>
        )}
      </Section>
      {!d.use3D && (
        <Section title="Outline" defaultOpen={d.border.enabled}>
          <Toggle label="Outline stroke" checked={d.border.enabled} onChange={v => set({ border: { enabled: v } })} />
          {d.border.enabled && (
            <>
              <ColorField value={d.border.color} onChange={v => set({ border: { color: v } }, 'bc')} />
              <Slider label="Width" value={d.border.width} min={1} max={50} defaultValue={12} onChange={v => set({ border: { width: v } }, 'bw')} />
              <Slider label="Opacity" value={d.border.opacity} min={0} max={100} unit="%" defaultValue={100} onChange={v => set({ border: { opacity: v } }, 'bo')} />
            </>
          )}
        </Section>
      )}
      <ApplyToAll screen={screen} part="device" label="Device" />
    </>
  )
}
