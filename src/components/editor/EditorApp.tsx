import { History, Loader2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as A from '~/lib/editor/actions'
import { current, getState, redo, select, toast, undo, useEditor } from '~/lib/editor/store'
import { getPlatform } from '~/lib/model/platforms'
import { watchFontLoading } from '~/lib/render/fonts'
import { Inspector } from './Inspector'
import { Sidebar } from './Sidebar'
import { Stage } from './Stage'
import { Topbar } from './Topbar'
import { BoardView, CompareView, StringsView } from './Views'
import { cx } from './ui'

async function uploadFiles(files: FileList | File[]) {
  const images = Array.from(files).filter(f => f.type.startsWith('image/'))
  if (!images.length) return
  try {
    const results = await A.uploadScreenshots(images.map(f => ({ name: f.name, blob: f })))
    const created = results.filter(r => r.action === 'created-screen').length
    const localized = results.length - created
    toast([created && `${created} screen${created > 1 ? 's' : ''} added`, localized && `${localized} localized image${localized > 1 ? 's' : ''} matched`].filter(Boolean).join(' · '), 'success')
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

export function EditorApp({ openPlatform, onPlatformOpened }: { openPlatform?: string; onPlatformOpened?: () => void } = {}) {
  const ready = useEditor(s => s.ready)
  const view = useEditor(s => s.ui.view)
  const toasts = useEditor(s => s.toasts)
  const legacy = useEditor(s => s.legacyAvailable)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [importingLegacy, setImportingLegacy] = useState(false)

  useEffect(() => {
    watchFontLoading()
    A.initEditor().catch(e => toast(`Could not open storage: ${(e as Error).message}`, 'error'))
  }, [])

  // Deep links from the screenshot-size pages: focus or add the requested platform.
  useEffect(() => {
    if (!ready || !openPlatform) return
    const c = current()
    if (getPlatform(openPlatform) && c.variant) {
      const existing = c.variant.decks.find(d => d.platformId === openPlatform)
      if (existing) select({ deckId: existing.id })
      else A.addPlatform(openPlatform)
    }
    onPlatformOpened?.()
  }, [ready, openPlatform])

  // Global shortcuts: undo/redo, screen navigation, paste to upload.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y' && !inField) {
        e.preventDefault()
        redo()
      } else if (!inField && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !getState().ui.selectedElementId) {
        const c = current()
        if (!c.deck || c.screenIndex < 0) return
        const next = c.deck.screens[c.screenIndex + (e.key === 'ArrowRight' ? 1 : -1)]
        if (next) select({ screenId: next.id })
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
      if (files.length) void uploadFiles(files.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `pasted-${Date.now()}-${i}.png`, { type: f.type })))
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-ed-bg text-ed-muted">
        <Loader2 className="mr-2 animate-spin" size={18} /> Opening your projects…
      </div>
    )
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-ed-bg text-ed-text"
      onDragOver={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={e => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={e => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setDragging(false)
        void uploadFiles(e.dataTransfer.files)
      }}
    >
      <Topbar onImportClick={() => importRef.current?.click()} />
      {legacy && (
        <div className="flex items-center gap-3 border-b border-brand-500/30 bg-brand-500/10 px-4 py-2 text-[13px]">
          <History size={15} className="text-brand-300" />
          <span className="flex-1">Projects from the previous version of Storedeck were found in this browser.</span>
          <button
            type="button"
            className="ed-btn-primary h-7"
            disabled={importingLegacy}
            onClick={async () => {
              setImportingLegacy(true)
              try {
                const n = await A.importLegacyProjects()
                toast(`Imported ${n} project${n === 1 ? '' : 's'}`, 'success')
              } catch (e) {
                toast((e as Error).message, 'error')
              } finally {
                setImportingLegacy(false)
              }
            }}
          >
            {importingLegacy ? <Loader2 size={13} className="animate-spin" /> : null} Import them
          </button>
          <button type="button" className="ed-icon-btn size-7" onClick={() => void A.dismissLegacyImport()} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar onUploadClick={() => fileRef.current?.click()} />
        <main className="relative min-w-0 flex-1">
          {view === 'design' && <Stage onUploadClick={() => fileRef.current?.click()} />}
          {view === 'board' && <BoardView />}
          {view === 'strings' && <StringsView />}
          {view === 'compare' && <CompareView />}
        </main>
        {view === 'design' && <Inspector />}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={e => {
          if (e.target.files) void uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const imported = await A.importProjectFile(await f.text())
            toast(`Imported ${imported.map(p => p.name).join(', ')}`, 'success')
          } catch (err) {
            toast((err as Error).message, 'error')
          }
        }}
      />
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-brand-900/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-300 bg-ed-panel/90 px-12 py-10">
            <Upload size={30} className="text-brand-300" />
            <div className="text-[15px] font-semibold">Drop to add screenshots</div>
            <div className="text-[12px] text-ed-muted">Files like home_de.png become German versions of matching screens</div>
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-sm rounded-lg border px-3.5 py-2.5 text-[13px] shadow-xl',
              t.kind === 'error' ? 'border-red-500/40 bg-red-950 text-red-200' : t.kind === 'success' ? 'border-emerald-500/30 bg-emerald-950 text-emerald-100' : 'border-ed-border bg-ed-raised text-ed-text',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
