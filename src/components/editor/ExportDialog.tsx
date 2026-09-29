import { Download, FileImage, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast, useEditor } from '~/lib/editor/store'
import { getLanguage } from '~/lib/model/languages'
import { getPlatform } from '~/lib/model/platforms'
import { canvasToBlob, downloadBlob, exportZip, planExport, renderScreenImage, slug, type ImageFormat } from '~/lib/render/service'
import { useCurrent } from './ScreenCanvas'
import { Dialog, Segmented, cx } from './ui'

function Check({ label, checked, onChange, sub }: { label: React.ReactNode; checked: boolean; onChange: () => void; sub?: React.ReactNode }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]', checked ? 'border-brand-500 bg-brand-500/10 text-ed-text' : 'border-ed-border text-ed-muted')}>
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-brand-500" />
      <span className="flex-1 truncate">{label}</span>
      {sub && <span className="text-[10px] text-ed-faint">{sub}</span>}
    </label>
  )
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCurrent()
  const project = useEditor(s => s.project)
  const [variantIds, setVariantIds] = useState<string[]>([])
  const [platformIds, setPlatformIds] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [format, setFormat] = useState<ImageFormat>('png')
  const [progress, setProgress] = useState<{ done: number; total: number; path: string } | null>(null)

  useEffect(() => {
    if (!open || !c) return
    setVariantIds(c.variant ? [c.variant.id] : [])
    setPlatformIds(c.deck ? [c.deck.platformId] : [])
    setLanguages([c.lang])
    // Reset scope each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const platformsInScope = useMemo(() => {
    const ids = new Set<string>()
    project?.variants.filter(v => variantIds.includes(v.id)).forEach(v => v.decks.forEach(d => ids.add(d.platformId)))
    return [...ids]
  }, [project, variantIds])

  const deckIds = useMemo(
    () => project?.variants.filter(v => variantIds.includes(v.id)).flatMap(v => v.decks.filter(d => platformIds.includes(d.platformId)).map(d => d.id)) ?? [],
    [project, variantIds, platformIds],
  )
  const plan = useMemo(() => (project ? planExport(project, { variantIds, deckIds, languages, format }) : []), [project, variantIds, deckIds, languages, format])
  if (!c || !project) return null
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const runZip = async () => {
    setProgress({ done: 0, total: plan.length, path: '' })
    try {
      const { blob, files } = await exportZip(project, { variantIds, deckIds, languages, format }, (done, total, path) => setProgress({ done, total, path }))
      downloadBlob(blob, `${slug(project.name)}-screenshots.zip`)
      toast(`Exported ${files} images`, 'success')
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setProgress(null)
    }
  }

  const runCurrent = async () => {
    if (!c.screen || !c.deck) return
    setProgress({ done: 0, total: 1, path: c.screen.name })
    try {
      const r = await renderScreenImage(c.screen, c.deck, project, c.lang)
      downloadBlob(await canvasToBlob(r.canvas, format), `${String(c.screenIndex + 1).padStart(2, '0')}-${slug(c.screen.name)}-${c.lang}.${format === 'jpeg' ? 'jpg' : 'png'}`)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export store images"
      width={640}
      footer={
        <>
          <button type="button" className="ed-btn mr-auto" disabled={!c.screen || !!progress} onClick={runCurrent}>
            <FileImage size={14} /> Current screen only
          </button>
          <button type="button" className="ed-btn-primary" disabled={!plan.length || !!progress} onClick={runZip}>
            {progress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download ZIP · {plan.length} images
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {project.variants.length > 1 && (
          <section>
            <div className="ed-label mb-2">A/B variants</div>
            <div className="grid grid-cols-2 gap-1.5">
              {project.variants.map(v => (
                <Check key={v.id} label={v.name} sub={v.status} checked={variantIds.includes(v.id)} onChange={() => toggle(variantIds, setVariantIds, v.id)} />
              ))}
            </div>
          </section>
        )}
        <section>
          <div className="ed-label mb-2">Platforms</div>
          <div className="grid grid-cols-2 gap-1.5">
            {platformsInScope.map(id => (
              <Check key={id} label={getPlatform(id)?.name ?? id} sub={getPlatform(id)?.store.replace('-', ' ')} checked={platformIds.includes(id)} onChange={() => toggle(platformIds, setPlatformIds, id)} />
            ))}
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="ed-label">Languages</span>
            <button type="button" className="text-[11px] text-brand-300 hover:underline" onClick={() => setLanguages(languages.length === project.languages.length ? [c.lang] : [...project.languages])}>
              {languages.length === project.languages.length ? 'Only current' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {project.languages.map(l => (
              <Check key={l} label={`${getLanguage(l).flag} ${getLanguage(l).name}`} checked={languages.includes(l)} onChange={() => toggle(languages, setLanguages, l)} />
            ))}
          </div>
        </section>
        <section className="flex items-center justify-between gap-4">
          <div>
            <div className="ed-label mb-1">Format</div>
            <p className="text-[11px] text-ed-faint">JPEG is flattened — App Store Connect and Play reject alpha channels.</p>
          </div>
          <div className="w-40">
            <Segmented
              size="sm"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpeg', label: 'JPEG' },
              ]}
            />
          </div>
        </section>
        <section className="rounded-lg border border-ed-border bg-ed-bg p-3">
          <div className="ed-label mb-1.5">Files</div>
          <ul className="ed-scroll max-h-32 space-y-0.5 overflow-y-auto font-mono text-[11px] text-ed-muted">
            {plan.slice(0, 50).map(p => (
              <li key={p.path}>{p.path}</li>
            ))}
            {plan.length > 50 && <li>… and {plan.length - 50} more</li>}
            {!plan.length && <li>Nothing selected.</li>}
          </ul>
        </section>
        {progress && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ed-border">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
            <div className="mt-1 truncate text-[11px] text-ed-faint">
              {progress.done}/{progress.total} {progress.path}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
