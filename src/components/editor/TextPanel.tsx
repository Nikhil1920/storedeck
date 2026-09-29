import { AlignCenter, AlignLeft, AlignRight, CaseUpper, Italic, Strikethrough, Underline } from 'lucide-react'
import * as A from '~/lib/editor/actions'
import { FONT_WEIGHTS } from '~/lib/model/defaults'
import { getLanguage } from '~/lib/model/languages'
import { effectiveLayout, type TextPatch } from '~/lib/model/ops'
import type { Screen, TextBlockStyle } from '~/lib/model/types'
import { ApplyToAll } from './Inspector'
import { FontPicker } from './pickers'
import { ColorField, Field, Section, Segmented, Slider, Toggle, cx } from './ui'

export function TextPanel({ screen, lang }: { screen: Screen; lang: string }) {
  const t = screen.text
  const hasOverride = !!t.languageOverrides[lang] && Object.keys(t.languageOverrides[lang]).length > 0
  const layout = effectiveLayout(t, lang)
  const set = (patch: TextPatch, key?: string, language?: string) => A.setTextStyle([screen.id], patch, language, key ? `${screen.id}:txt:${key}:${language ?? ''}` : undefined)
  const layoutLang = hasOverride ? lang : undefined
  const flag = getLanguage(lang).flag

  return (
    <>
      {(['headline', 'subheadline'] as const).map(kind => (
        <TextBlock key={kind} kind={kind} screen={screen} lang={lang} flag={flag} style={t[kind]} size={kind === 'headline' ? layout.headlineSize : layout.subheadlineSize} layoutLang={layoutLang} set={set} />
      ))}
      <Section title="Layout">
        <div className="grid grid-cols-2 gap-2">
          <Segmented
            size="sm"
            value={t.position}
            onChange={position => set({ position })}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
            ]}
          />
          <Segmented
            size="sm"
            value={t.align}
            onChange={align => set({ align })}
            options={[
              { value: 'left', label: <AlignLeft size={13} />, title: 'Align left (start in RTL)' },
              { value: 'center', label: <AlignCenter size={13} />, title: 'Center' },
              { value: 'right', label: <AlignRight size={13} />, title: 'Align right' },
            ]}
          />
        </div>
        <Slider label={`Distance from ${t.position}`} value={layout.offsetY} min={-20} max={90} unit="%" defaultValue={t.offsetY} onChange={v => set({ offsetY: v }, 'offset', layoutLang)} />
        <Slider label="Line height" value={layout.lineHeight} min={70} max={200} unit="%" defaultValue={110} onChange={v => set({ lineHeight: v }, 'lh', layoutLang)} />
        <Slider label="Gap to subheadline" value={t.gap} min={0} max={150} unit="%" defaultValue={30} onChange={v => set({ gap: v }, 'gap')} />
        <Slider label="Text width" value={t.maxWidth} min={20} max={100} unit="%" defaultValue={84} onChange={v => set({ maxWidth: v }, 'mw')} />
        <Slider label="Horizontal center" value={t.x} min={0} max={100} unit="%" defaultValue={50} onChange={v => set({ x: v }, 'x')} />
      </Section>
      <Section title={`Language layout ${flag}`} defaultOpen={hasOverride}>
        <Toggle
          label={`Custom sizes for ${getLanguage(lang).name}`}
          hint="Long German words or short CJK copy? Override size, distance and line height for this language only."
          checked={hasOverride}
          onChange={v => {
            if (v) set({ headline: { size: layout.headlineSize }, subheadline: { size: layout.subheadlineSize }, offsetY: layout.offsetY, lineHeight: layout.lineHeight }, undefined, lang)
            else A.clearLanguageOverride([screen.id], lang)
          }}
        />
      </Section>
      <ApplyToAll screen={screen} part="text" label="Text style" />
    </>
  )
}

function TextBlock({
  kind,
  screen,
  lang,
  flag,
  style,
  size,
  layoutLang,
  set,
}: {
  kind: 'headline' | 'subheadline'
  screen: Screen
  lang: string
  flag: string
  style: TextBlockStyle
  size: number
  layoutLang?: string
  set: (patch: TextPatch, key?: string, language?: string) => void
}) {
  const copy = screen.copy[kind][lang] ?? ''
  const fallback = !copy ? Object.values(screen.copy[kind]).find(v => v.trim()) : undefined
  const setStyle = (patch: Partial<TextBlockStyle>, key?: string) => set({ [kind]: patch } as TextPatch, key ? `${kind}:${key}` : undefined)
  const toggles: Array<{ key: keyof TextBlockStyle; icon: React.ReactNode; title: string }> = [
    { key: 'italic', icon: <Italic size={13} />, title: 'Italic' },
    { key: 'underline', icon: <Underline size={13} />, title: 'Underline' },
    { key: 'strikethrough', icon: <Strikethrough size={13} />, title: 'Strikethrough' },
    { key: 'uppercase', icon: <CaseUpper size={14} />, title: 'Uppercase' },
  ]
  return (
    <Section
      title={kind === 'headline' ? 'Headline' : 'Subheadline'}
      right={
        <button type="button" role="switch" aria-checked={style.enabled} aria-label={`Show ${kind}`} onClick={() => setStyle({ enabled: !style.enabled })} className={cx('relative h-4 w-7 rounded-full transition', style.enabled ? 'bg-brand-500' : 'bg-ed-border')}>
          <span className={cx('absolute top-0.5 size-3 rounded-full bg-white transition-all', style.enabled ? 'left-3.5' : 'left-0.5')} />
        </button>
      }
    >
      <Field label={<span className="flex items-center justify-between">Copy <span className="normal-case tracking-normal">{flag} {lang}</span></span>}>
        <textarea
          className="ed-input h-auto min-h-[64px] resize-y py-1.5 leading-5"
          value={copy}
          placeholder={fallback ? `Fallback: ${fallback}` : kind === 'headline' ? 'Track every habit' : 'Build streaks that stick with gentle reminders'}
          onChange={e => A.setCopy([{ screenId: screen.id, field: kind, language: lang, text: e.target.value }], `${screen.id}:copy:${kind}:${lang}`)}
        />
      </Field>
      <Field label="Font">
        <FontPicker value={style.font} onChange={font => setStyle({ font })} />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select className="ed-select" value={style.weight} onChange={e => setStyle({ weight: e.target.value })} aria-label="Weight">
          {FONT_WEIGHTS.map(w => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
        <div className="flex rounded-md border border-ed-border bg-ed-bg p-0.5">
          {toggles.map(tg => (
            <button key={tg.key} type="button" title={tg.title} aria-pressed={!!style[tg.key]} onClick={() => setStyle({ [tg.key]: !style[tg.key] })} className={cx('flex size-7 items-center justify-center rounded', style[tg.key] ? 'bg-ed-hover text-ed-text' : 'text-ed-faint hover:text-ed-text')}>
              {tg.icon}
            </button>
          ))}
        </div>
      </div>
      <Slider label={layoutLang ? `Size (${layoutLang})` : 'Size'} value={size} min={8} max={400} unit="px" onChange={v => set({ [kind]: { size: v } } as TextPatch, `${kind}:size`, layoutLang)} />
      <ColorField value={style.color} onChange={color => setStyle({ color }, 'color')} />
      <Slider label="Opacity" value={style.opacity} min={0} max={100} unit="%" defaultValue={100} onChange={v => setStyle({ opacity: v }, 'op')} />
      <Slider label="Letter spacing" value={style.letterSpacing} min={-10} max={30} defaultValue={0} onChange={v => setStyle({ letterSpacing: v }, 'ls')} />
    </Section>
  )
}
