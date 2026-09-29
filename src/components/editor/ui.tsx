// Small, dependency-free editor controls.

import { ChevronDown, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <div className="ed-label">{label}</div>
      {children}
      {hint && <p className="text-[11px] leading-4 text-ed-faint">{hint}</p>}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  defaultValue?: number
  onChange: (v: number) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const display = Math.round(value * 10) / 10
  return (
    <div className="group space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[12px] text-ed-muted">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {defaultValue !== undefined && value !== defaultValue && (
            <button type="button" title="Reset" className="rounded p-0.5 text-ed-faint opacity-0 transition group-hover:opacity-100 hover:text-ed-text" onClick={() => onChange(defaultValue)}>
              <RotateCcw size={11} />
            </button>
          )}
          <input
            aria-label={`${label} value`}
            className="w-12 rounded bg-transparent text-right text-[12px] tabular-nums text-ed-text outline-none focus:bg-ed-bg"
            value={draft ?? String(display)}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => {
              const n = Number(draft)
              if (draft !== null && Number.isFinite(n)) onChange(n)
              setDraft(null)
            }}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <span className="w-3 text-[11px] text-ed-faint">{unit}</span>
        </div>
      </div>
      <input id={id} type="range" className="ed-range w-full" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

export function ColorField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-2">
      <input type="color" className="ed-color shrink-0" aria-label={label ?? 'Color'} value={value} onChange={e => onChange(e.target.value)} />
      <input
        className="ed-input font-mono uppercase"
        aria-label={`${label ?? 'Color'} hex`}
        value={draft ?? value}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft?.startsWith('#') ? draft : `#${draft}`
          if (draft !== null && /^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase())
          setDraft(null)
        }}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {label && <span className="shrink-0 text-[12px] text-ed-muted">{label}</span>}
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[13px] text-ed-text">{label}</span>
        {hint && <span className="block text-[11px] text-ed-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand-500' : 'bg-ed-border')}
      >
        <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: Array<{ value: T; label: ReactNode; title?: string }>; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex rounded-md border border-ed-border bg-ed-bg p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex flex-1 items-center justify-center gap-1 rounded px-2 font-medium transition',
            size === 'sm' ? 'h-6 text-[11px]' : 'h-7 text-[12px]',
            o.value === value ? 'bg-ed-hover text-ed-text shadow-sm' : 'text-ed-muted hover:text-ed-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Section({ title, children, defaultOpen = true, right }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-ed-border">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex flex-1 items-center gap-1.5 text-left text-[12px] font-semibold text-ed-text">
          <ChevronDown size={14} className={cx('text-ed-faint transition', !open && '-rotate-90')} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </section>
  )
}

export function Dialog({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={e => {
        e.preventDefault()
        onClose()
      }}
      onClick={e => e.target === ref.current && onClose()}
      className="ed-dialog m-auto max-h-[85vh] rounded-xl border border-ed-border bg-ed-panel p-0 text-ed-text shadow-2xl"
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-ed-border px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button type="button" className="ed-icon-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </header>
          <div className="ed-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-ed-border px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

/** Click-to-open popover menu anchored below its trigger. */
export function Popover({ trigger, children, align = 'left', width = 260 }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen(o => !o))}
      {open && (
        <div
          className={cx('absolute top-full z-50 mt-1.5 rounded-lg border border-ed-border bg-ed-raised p-1 shadow-2xl shadow-black/50', align === 'right' ? 'right-0' : 'left-0')}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ children, onClick, danger, icon, active, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; icon?: ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition disabled:opacity-40',
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-ed-text hover:bg-ed-hover',
        active && 'bg-ed-hover',
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center text-ed-muted">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-ed-border" />
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="text-ed-faint">{icon}</div>
      <div className="text-[13px] font-medium text-ed-text">{title}</div>
      {children && <div className="text-[12px] leading-5 text-ed-muted">{children}</div>}
    </div>
  )
}
