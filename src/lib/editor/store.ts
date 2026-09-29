// Editor state lives outside React so the UI, keyboard shortcuts and the
// WebMCP tools all drive the same store. Document edits go through `mutate`,
// which records immer patches for undo/redo and schedules persistence.

import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { findDeck, findVariant, projectMeta } from '../model/ops'
import { resolveDeckSize } from '../model/platforms'
import type { PlatformDeck, Project, ProjectMeta, Screen, Selection, Variant } from '../model/types'
import { putProject } from '../storage/db'

enablePatches()

export type InspectorTab = 'background' | 'device' | 'text' | 'elements' | 'popouts'
export type EditorView = 'design' | 'board' | 'strings' | 'compare'

export interface EditorUi {
  view: EditorView
  inspectorTab: InspectorTab
  selectedElementId: string | null
  selectedPopoutId: string | null
  /** Variants shown side by side in the compare view. */
  compareVariantIds: string[]
  showSafeArea: boolean
}

export interface HistoryEntry {
  label: string
  key: string
  at: number
  patches: Patch[]
  inverse: Patch[]
}

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'success' | 'error'
}

export interface EditorState {
  ready: boolean
  projects: ProjectMeta[]
  project: Project | null
  sel: Selection
  ui: EditorUi
  past: HistoryEntry[]
  future: HistoryEntry[]
  saveState: 'idle' | 'pending' | 'saved' | 'error'
  legacyAvailable: boolean
  /** Bumped whenever a decoded image or 3D model becomes available. */
  assetsVersion: number
  toasts: Toast[]
  /** Label of the WebMCP tool currently executing, shown in the UI. */
  agentActivity: string | null
}

export const initialUi: EditorUi = {
  view: 'design',
  inspectorTab: 'background',
  selectedElementId: null,
  selectedPopoutId: null,
  compareVariantIds: [],
  showSafeArea: false,
}

function createEditorStore() {
  return createStore<EditorState>()(() => ({
  ready: false,
  projects: [],
  project: null,
  sel: { variantId: null, deckId: null, screenId: null, language: 'en' },
  ui: initialUi,
  past: [],
  future: [],
  saveState: 'idle',
  legacyAvailable: false,
  assetsVersion: 0,
  toasts: [],
  agentActivity: null,
  }))
}

// Keep one store across dev hot-reloads so edits to modules don't orphan the open project.
const g = globalThis as unknown as { __storedeckStore?: ReturnType<typeof createEditorStore> }
export const editorStore = import.meta.hot ? (g.__storedeckStore ??= createEditorStore()) : createEditorStore()

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(editorStore, selector)
}

export const getState = () => editorStore.getState()
export const setState = editorStore.setState

// ---------------------------------------------------------------- current selection

export interface Current {
  project: Project
  variant: Variant | null
  deck: PlatformDeck | null
  screen: Screen | null
  screenIndex: number
  lang: string
}

export function currentOf(s: Pick<EditorState, 'project' | 'sel'>): Current | null {
  const project = s.project
  if (!project) return null
  const variant = (s.sel.variantId && findVariant(project, s.sel.variantId)) || null
  const deck = (variant && s.sel.deckId && variant.decks.find(d => d.id === s.sel.deckId)) || null
  const screenIndex = deck && s.sel.screenId ? deck.screens.findIndex(x => x.id === s.sel.screenId) : -1
  return { project, variant, deck, screen: deck && screenIndex >= 0 ? deck.screens[screenIndex] : null, screenIndex, lang: s.sel.language }
}

export function current(): Current {
  const c = currentOf(getState())
  if (!c) throw new Error('No project is open')
  return c
}

export function requireProject(): Project {
  const p = getState().project
  if (!p) throw new Error('No project is open')
  return p
}

/** Makes a selection consistent with the document (valid ids, language in project). */
export function normalizeSelection(project: Project, sel: Selection, prev?: Selection): Selection {
  let variant = sel.variantId ? findVariant(project, sel.variantId) : undefined
  if (!variant) variant = project.variants[0]
  let deck = variant && sel.deckId ? variant.decks.find(d => d.id === sel.deckId) : undefined
  if (!deck && variant && prev?.deckId) {
    // Switching variants keeps the same platform when the new variant has it.
    const prevDeck = findDeck(project, prev.deckId)?.deck
    if (prevDeck) deck = variant.decks.find(d => d.platformId === prevDeck.platformId)
  }
  if (!deck) deck = variant?.decks[0]
  let screenId = deck && sel.screenId && deck.screens.some(s => s.id === sel.screenId) ? sel.screenId : null
  if (!screenId && deck?.screens.length) {
    // Keep the same position when switching variant/platform.
    const prevLoc = prev?.screenId ? findScreenIndex(project, prev.screenId) : -1
    screenId = deck.screens[Math.max(0, Math.min(prevLoc, deck.screens.length - 1))]?.id ?? deck.screens[0].id
  }
  const language = project.languages.includes(sel.language) ? sel.language : project.defaultLanguage
  return { variantId: variant?.id ?? null, deckId: deck?.id ?? null, screenId, language }
}

function findScreenIndex(project: Project, screenId: string): number {
  for (const v of project.variants) for (const d of v.decks) {
    const i = d.screens.findIndex(s => s.id === screenId)
    if (i !== -1) return i
  }
  return -1
}

export function select(partial: Partial<Selection>): Selection {
  const s = getState()
  if (!s.project) throw new Error('No project is open')
  const merged: Selection = { ...s.sel, ...partial }
  if (partial.variantId && partial.variantId !== s.sel.variantId && partial.deckId === undefined) merged.deckId = null
  if ((partial.deckId || merged.deckId === null) && partial.screenId === undefined && partial.deckId !== s.sel.deckId) merged.screenId = null
  const sel = normalizeSelection(s.project, merged, s.sel)
  const screenChanged = sel.screenId !== s.sel.screenId
  setState({
    sel,
    ui: screenChanged ? { ...s.ui, selectedElementId: null, selectedPopoutId: null } : s.ui,
    project: { ...s.project, lastSelection: sel },
  })
  return sel
}

// ---------------------------------------------------------------- mutations & history

export interface MutateOptions {
  /** Consecutive edits with the same key within a second merge into one undo step. */
  coalesceKey?: string
}

export function mutate<T = void>(label: string, recipe: (draft: Project) => T, opts: MutateOptions = {}): T {
  const s = getState()
  if (!s.project) throw new Error('No project is open')
  let result: T | undefined
  const [next, patches, inverse] = produceWithPatches(s.project, draft => {
    result = recipe(draft as Project)
  })
  if (!patches.length) return result as T
  const now = Date.now()
  const last = s.past[s.past.length - 1]
  let past: HistoryEntry[]
  if (opts.coalesceKey && last && last.key === opts.coalesceKey && now - last.at < 1000) {
    past = [...s.past.slice(0, -1), { ...last, at: now, patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse] }]
  } else {
    past = [...s.past, { label, key: opts.coalesceKey ?? `${label}:${now}`, at: now, patches, inverse }].slice(-200)
  }
  setState({ project: next, past, future: [], sel: normalizeSelection(next, s.sel, s.sel) })
  return result as T
}

export function undo(): string | null {
  const s = getState()
  const entry = s.past[s.past.length - 1]
  if (!entry || !s.project) return null
  const project = applyPatches(s.project, entry.inverse)
  setState({ project, past: s.past.slice(0, -1), future: [entry, ...s.future], sel: normalizeSelection(project, s.sel, s.sel) })
  return entry.label
}

export function redo(): string | null {
  const s = getState()
  const entry = s.future[0]
  if (!entry || !s.project) return null
  const project = applyPatches(s.project, entry.patches)
  setState({ project, past: [...s.past, entry], future: s.future.slice(1), sel: normalizeSelection(project, s.sel, s.sel) })
  return entry.label
}

export function setUi(patch: Partial<EditorUi>): void {
  setState(s => ({ ui: { ...s.ui, ...patch } }))
}

let toastSeq = 0
export function toast(message: string, kind: Toast['kind'] = 'info'): void {
  const id = ++toastSeq
  setState(s => ({ toasts: [...s.toasts.slice(-3), { id, message, kind }] }))
  if (typeof window !== 'undefined') setTimeout(() => setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3800)
}

export function bumpAssets(): void {
  setState(s => ({ assetsVersion: s.assetsVersion + 1 }))
}

export function deckDims(deck: PlatformDeck) {
  return resolveDeckSize(deck)
}

// ---------------------------------------------------------------- persistence

let saveTimer: ReturnType<typeof setTimeout> | null = null
let persistenceEnabled = false

export function enablePersistence(): void {
  if (persistenceEnabled) return
  persistenceEnabled = true
  editorStore.subscribe((s, prev) => {
    if (s.project && s.project !== prev.project && s.project.id === prev.project?.id) scheduleSave()
  })
  if (typeof window !== 'undefined') {
    const flushNow = () => void flushSave()
    window.addEventListener('pagehide', flushNow)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow())
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  setState({ saveState: 'pending' })
  saveTimer = setTimeout(() => void flushSave(), 400)
}

export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const project = getState().project
  if (!project) return
  const stamped = { ...project, updatedAt: Date.now() }
  try {
    await putProject(stamped)
    const meta = projectMeta(stamped)
    setState(s => ({ saveState: 'saved', projects: s.projects.map(p => (p.id === meta.id ? meta : p)) }))
  } catch (e) {
    console.error('Saving project failed', e)
    setState({ saveState: 'error' })
  }
}
