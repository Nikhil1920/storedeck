import { Link } from '@tanstack/react-router'
import {
  Bot,
  Check,
  ChevronDown,
  CloudOff,
  Columns2,
  Copy,
  Download,
  FileDown,
  FileUp,
  FlaskConical,
  FolderOpen,
  Grid3x3,
  Languages,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Redo2,
  ScanLine,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import * as A from '~/lib/editor/actions'
import { getState, redo, select, setUi, toast, undo, useEditor, type EditorView } from '~/lib/editor/store'
import { getLanguage, LANGUAGES } from '~/lib/model/languages'
import { PLATFORMS } from '~/lib/model/platforms'
import type { Variant, VariantStatus } from '~/lib/model/types'
import { downloadBlob, slug } from '~/lib/render/service'
import { ExportDialog } from './ExportDialog'
import { useCurrent } from './ScreenCanvas'
import { Logo } from '../Logo'
import { Dialog, Field, MenuDivider, MenuItem, Popover, Segmented, cx } from './ui'

const STATUS_STYLE: Record<VariantStatus, string> = {
  draft: 'bg-zinc-500/20 text-zinc-300',
  control: 'bg-sky-500/20 text-sky-300',
  testing: 'bg-amber-500/20 text-amber-300',
  winner: 'bg-emerald-500/20 text-emerald-300',
  archived: 'bg-zinc-700/40 text-zinc-500',
}

export function Topbar({ onImportClick }: { onImportClick: () => void }) {
  const c = useCurrent()
  const view = useEditor(s => s.ui.view)
  const canUndo = useEditor(s => s.past.length > 0)
  const canRedo = useEditor(s => s.future.length > 0)
  const saveState = useEditor(s => s.saveState)
  const agent = useEditor(s => s.agentActivity)
  const [exporting, setExporting] = useState(false)
  if (!c) return null
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ed-border bg-ed-panel px-3">
      <Link to="/" className="mr-1 text-ed-text" aria-label="Storedeck home">
        <Logo className="text-[14px]" />
      </Link>
      <div className="h-5 w-px bg-ed-border" />
      <ProjectMenu onImportClick={onImportClick} />
      <div className="h-5 w-px bg-ed-border" />
      <VariantTabs />
      <div className="flex-1" />
      {agent && (
        <span className="flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-medium text-brand-200" role="status">
          <Bot size={13} className="animate-pulse" /> Agent: {agent}
        </span>
      )}
      <Segmented<EditorView>
        size="sm"
        value={view}
        onChange={v => setUi({ view: v })}
        options={[
          { value: 'design', label: <><LayoutTemplate size={13} /> Design</>, title: 'Design one screen' },
          { value: 'board', label: <><Grid3x3 size={13} /> Board</>, title: 'All screens × languages' },
          { value: 'strings', label: <><Table2 size={13} /> Strings</>, title: 'Localization table' },
          { value: 'compare', label: <><Columns2 size={13} /> Compare</>, title: 'A/B variants side by side' },
        ]}
      />
      <LanguageMenu />
      <div className="flex items-center">
        <button type="button" className="ed-icon-btn" disabled={!canUndo} onClick={() => undo()} title="Undo (⌘Z)" aria-label="Undo">
          <Undo2 size={16} />
        </button>
        <button type="button" className="ed-icon-btn" disabled={!canRedo} onClick={() => redo()} title="Redo (⇧⌘Z)" aria-label="Redo">
          <Redo2 size={16} />
        </button>
        <button type="button" className="ed-icon-btn" onClick={() => setUi({ showSafeArea: !getState().ui.showSafeArea })} title="Toggle safe-area guides" aria-label="Toggle guides">
          <ScanLine size={16} />
        </button>
      </div>
      <span className="w-14 text-center text-[11px] text-ed-faint" aria-live="polite">
        {saveState === 'pending' ? <Loader2 size={13} className="mx-auto animate-spin" /> : saveState === 'error' ? <CloudOff size={14} className="mx-auto text-red-400" /> : saveState === 'saved' ? 'Saved' : ''}
      </span>
      <button type="button" className="ed-btn-primary" onClick={() => setExporting(true)}>
        <Download size={15} /> Export
      </button>
      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
    </header>
  )
}

function ProjectMenu({ onImportClick }: { onImportClick: () => void }) {
  const project = useEditor(s => s.project!)
  const projects = useEditor(s => s.projects)
  const [dialog, setDialog] = useState<null | 'new' | 'rename' | 'delete'>(null)
  return (
    <>
      <Popover
        width={280}
        trigger={(_, toggle) => (
          <button type="button" onClick={toggle} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-ed-text hover:bg-ed-hover">
            <FolderOpen size={14} className="text-ed-muted" />
            <span className="max-w-40 truncate">{project.name}</span>
            <ChevronDown size={13} className="text-ed-faint" />
          </button>
        )}
      >
        {close => (
          <div>
            <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ed-faint">Projects</div>
            <div className="ed-scroll max-h-56 overflow-y-auto">
              {[...projects]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(p => (
                  <MenuItem key={p.id} active={p.id === project.id} icon={p.id === project.id ? <Check size={13} /> : undefined} onClick={() => (void A.openProject(p.id), close())}>
                    <span className="flex justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-ed-faint">{p.screenCount}</span>
                    </span>
                  </MenuItem>
                ))}
            </div>
            <MenuDivider />
            <MenuItem icon={<Plus size={14} />} onClick={() => (setDialog('new'), close())}>
              New project…
            </MenuItem>
            <MenuItem icon={<Pencil size={14} />} onClick={() => (setDialog('rename'), close())}>
              Rename…
            </MenuItem>
            <MenuItem icon={<Copy size={14} />} onClick={() => (void A.duplicateProject(project.id), close())}>
              Duplicate
            </MenuItem>
            <MenuDivider />
            <MenuItem
              icon={<FileDown size={14} />}
              onClick={async () => {
                close()
                const bundle = await A.exportProjectBundle()
                downloadBlob(new Blob([JSON.stringify(bundle)], { type: 'application/json' }), `${slug(project.name)}.storedeck.json`)
              }}
            >
              Export project file
            </MenuItem>
            <MenuItem icon={<FileUp size={14} />} onClick={() => (onImportClick(), close())}>
              Import project file…
            </MenuItem>
            <MenuDivider />
            <MenuItem icon={<Trash2 size={14} />} danger onClick={() => (setDialog('delete'), close())}>
              Delete project…
            </MenuItem>
          </div>
        )}
      </Popover>
      <NewProjectDialog open={dialog === 'new'} onClose={() => setDialog(null)} />
      <PromptDialog
        open={dialog === 'rename'}
        title="Rename project"
        label="Project name"
        initial={project.name}
        onClose={() => setDialog(null)}
        onSubmit={name => A.renameProject(name)}
      />
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete project?"
        width={420}
        footer={
          <>
            <button type="button" className="ed-btn" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="ed-btn border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
              onClick={() => {
                void A.deleteProject(project.id)
                setDialog(null)
              }}
            >
              Delete permanently
            </button>
          </>
        }
      >
        <p className="text-[13px] leading-6 text-ed-muted">
          <strong className="text-ed-text">{project.name}</strong> and all its variants, platforms and screenshots will be removed from this browser. Export a project file first if you might need it again.
        </p>
      </Dialog>
    </>
  )
}

export function PromptDialog({ open, title, label, initial, onClose, onSubmit, multiline }: { open: boolean; title: string; label: string; initial: string; onClose: () => void; onSubmit: (v: string) => void; multiline?: boolean }) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const submit = () => {
    const v = ref.current?.value.trim() ?? ''
    if (!v && !multiline) return
    try {
      onSubmit(v)
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <>
          <button type="button" className="ed-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ed-btn-primary" onClick={submit}>
            Save
          </button>
        </>
      }
    >
      <Field label={label}>
        {multiline ? (
          <textarea ref={ref} defaultValue={initial} className="ed-input h-24 py-2" autoFocus />
        ) : (
          <input ref={ref} defaultValue={initial} className="ed-input" autoFocus onKeyDown={e => e.key === 'Enter' && submit()} />
        )}
      </Field>
    </Dialog>
  )
}

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['app-store-iphone', 'google-play-phone'])
  const quick = ['app-store-iphone', 'app-store-ipad', 'google-play-phone', 'google-play-tablet-10', 'app-store-mac', 'ms-store-desktop', 'app-store-apple-tv', 'google-play-tv', 'amazon-fire-tv', 'steam-screenshots']
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      footer={
        <>
          <button type="button" className="ed-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ed-btn-primary"
            disabled={!name.trim() || !platforms.length}
            onClick={async () => {
              await A.createProject(name, { platformIds: platforms })
              setName('')
              onClose()
            }}
          >
            Create project
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="App / project name">
          <input className="ed-input" value={name} onChange={e => setName(e.target.value)} placeholder="Veena" autoFocus />
        </Field>
        <Field label="Platforms" hint="You can add more later — or copy a finished platform to a new one.">
          <div className="grid grid-cols-2 gap-1.5">
            {quick.map(id => {
              const p = PLATFORMS.find(x => x.id === id)!
              const on = platforms.includes(id)
              return (
                <label key={id} className={cx('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]', on ? 'border-brand-500 bg-brand-500/10' : 'border-ed-border')}>
                  <input type="checkbox" checked={on} onChange={() => setPlatforms(on ? platforms.filter(x => x !== id) : [...platforms, id])} />
                  {p.name} <span className="ml-auto text-[10px] text-ed-faint">{p.store.replace('-', ' ')}</span>
                </label>
              )
            })}
          </div>
        </Field>
      </div>
    </Dialog>
  )
}

function VariantTabs() {
  const c = useCurrent()!
  const [editing, setEditing] = useState<Variant | null>(null)
  return (
    <div className="flex min-w-0 items-center gap-1">
      <FlaskConical size={14} className="shrink-0 text-ed-faint" aria-hidden />
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {c.project.variants.map(v => (
          <div key={v.id} className={cx('group flex shrink-0 items-center rounded-md', v.id === c.variant?.id ? 'bg-ed-hover' : 'hover:bg-ed-raised')}>
            <button type="button" onClick={() => select({ variantId: v.id })} className="flex items-center gap-1.5 py-1 pr-1 pl-2 text-[12px]">
              <span className={v.id === c.variant?.id ? 'text-ed-text' : 'text-ed-muted'}>{v.name}</span>
              <span className={cx('rounded px-1 text-[9px] font-semibold uppercase', STATUS_STYLE[v.status])}>{v.status}</span>
            </button>
            <button type="button" onClick={() => setEditing(v)} className="ed-icon-btn size-6 opacity-0 group-hover:opacity-100" aria-label={`Edit ${v.name}`}>
              <Pencil size={11} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="ed-icon-btn size-7 shrink-0" title="New A/B variant (copies the current one)" aria-label="New variant" onClick={() => A.addVariant()}>
        <Plus size={14} />
      </button>
      {editing && <VariantDialog variant={editing} onClose={() => setEditing(null)} canDelete={c.project.variants.length > 1} />}
    </div>
  )
}

function VariantDialog({ variant, onClose, canDelete }: { variant: Variant; onClose: () => void; canDelete: boolean }) {
  const [name, setName] = useState(variant.name)
  const [status, setStatus] = useState<VariantStatus>(variant.status)
  const [hypothesis, setHypothesis] = useState(variant.hypothesis)
  return (
    <Dialog
      open
      onClose={onClose}
      title="A/B variant"
      width={460}
      footer={
        <>
          <button
            type="button"
            className="ed-btn mr-auto text-red-300"
            disabled={!canDelete}
            onClick={() => {
              A.deleteVariant(variant.id)
              onClose()
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
          <button type="button" className="ed-btn" onClick={() => A.addVariant({ cloneFromVariantId: variant.id, name: `${variant.name} copy` })}>
            <Copy size={13} /> Duplicate
          </button>
          <button
            type="button"
            className="ed-btn-primary"
            onClick={() => {
              try {
                A.updateVariant(variant.id, { name, status, hypothesis })
                onClose()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className="ed-input" value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Status" hint="One control and one winner at a time — use these to track App Store Product Page Optimization or Play store listing experiments.">
          <Segmented
            size="sm"
            value={status}
            onChange={setStatus}
            options={(['draft', 'control', 'testing', 'winner', 'archived'] as const).map(s => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Hypothesis">
          <textarea className="ed-input h-20 py-2" value={hypothesis} onChange={e => setHypothesis(e.target.value)} placeholder="Benefit-led headlines will lift conversion over feature names." />
        </Field>
      </div>
    </Dialog>
  )
}

function LanguageMenu() {
  const c = useCurrent()!
  const [managing, setManaging] = useState(false)
  const info = getLanguage(c.lang)
  return (
    <>
      <Popover
        align="right"
        width={240}
        trigger={(_, toggle) => (
          <button type="button" onClick={toggle} className="flex items-center gap-1.5 rounded-md border border-ed-border px-2 py-1 text-[12px] text-ed-text hover:bg-ed-hover" title="Preview language">
            <span>{info.flag}</span>
            <span className="uppercase">{c.lang}</span>
            <ChevronDown size={12} className="text-ed-faint" />
          </button>
        )}
      >
        {close => (
          <div>
            {c.project.languages.map(l => (
              <MenuItem key={l} active={l === c.lang} onClick={() => (A.switchLanguage(l), close())} icon={<span>{getLanguage(l).flag}</span>}>
                <span className="flex justify-between">
                  {getLanguage(l).name}
                  {l === c.project.defaultLanguage && <span className="text-[10px] text-ed-faint">default</span>}
                </span>
              </MenuItem>
            ))}
            <MenuDivider />
            <MenuItem icon={<Languages size={14} />} onClick={() => (setManaging(true), close())}>
              Manage languages…
            </MenuItem>
          </div>
        )}
      </Popover>
      <LanguagesDialog open={managing} onClose={() => setManaging(false)} />
    </>
  )
}

function LanguagesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor(s => s.project!)
  const [query, setQuery] = useState('')
  const available = LANGUAGES.filter(l => !project.languages.includes(l.code) && (!query || `${l.name} ${l.native} ${l.code}`.toLowerCase().includes(query.toLowerCase())))
  return (
    <Dialog open={open} onClose={onClose} title="Project languages" width={560}>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="ed-label mb-2">In this project</div>
          <ul className="space-y-1">
            {project.languages.map(l => (
              <li key={l} className="flex items-center gap-2 rounded-md bg-ed-raised px-2.5 py-1.5 text-[13px]">
                <span>{getLanguage(l).flag}</span>
                <span className="flex-1">{getLanguage(l).name}</span>
                {l === project.defaultLanguage ? (
                  <span className="ed-chip">default</span>
                ) : (
                  <button type="button" className="text-[11px] text-ed-muted hover:text-ed-text" onClick={() => A.setDefaultLanguage(l)}>
                    Make default
                  </button>
                )}
                <button type="button" className="ed-icon-btn size-6" disabled={project.languages.length <= 1} onClick={() => A.removeLanguage(l)} aria-label={`Remove ${l}`}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-ed-faint">Removing a language keeps its copy — re-add it to bring everything back. Missing copy falls back to the default language.</p>
        </div>
        <div>
          <input className="ed-input mb-2" placeholder="Add language…" value={query} onChange={e => setQuery(e.target.value)} />
          <ul className="ed-scroll max-h-72 space-y-0.5 overflow-y-auto">
            {available.map(l => (
              <li key={l.code}>
                <button type="button" onClick={() => A.addLanguages([l.code])} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-ed-hover">
                  <span>{l.flag}</span>
                  <span className="flex-1">{l.name}</span>
                  <span className="text-[11px] text-ed-faint">{l.native}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  )
}
