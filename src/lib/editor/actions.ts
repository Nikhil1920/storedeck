// Domain actions used by both the React UI and the WebMCP tools. Every action
// validates its input and throws descriptive errors (they reach agents as-is).

import { defaultBackground, defaultDevice, defaultText, newProject, newTextElement, newPopout, newId, type PositionPresetId } from '../model/defaults'
import { baseFilename, detectLanguageFromFilename, isValidLangCode, normalizeLang } from '../model/languages'
import { convertLegacyProject } from '../model/legacy'
import * as ops from '../model/ops'
import { requirePlatform, resolveDeckSize, validateSize } from '../model/platforms'
import type { AssetRef, Background, CanvasElement, ChromeStyle, DeviceSettings, Popout, Project, Screen, Selection, TextSettings, VariantStatus } from '../model/types'
import { SCHEMA_VERSION } from '../model/types'
import { assetToDataUrl, ensureImages, importDataUrl, importImageBlob, onAssetLoaded } from '../storage/assets'
import {
  collectGarbageAssets,
  deleteProjectRecord,
  getKv,
  getProject,
  legacyDatabaseExists,
  legacyNames,
  listProjects,
  putProject,
  readLegacyDatabase,
  setKv,
} from '../storage/db'
import {
  bumpAssets,
  current,
  enablePersistence,
  flushSave,
  getState,
  initialUi,
  mutate,
  normalizeSelection,
  requireProject,
  select,
  setState,
  toast,
} from './store'

// ---------------------------------------------------------------- bootstrap

let initPromise: Promise<void> | null = null

export function initEditor(): Promise<void> {
  if (!initPromise) initPromise = doInit()
  return initPromise
}

async function doInit() {
  enablePersistence()
  onAssetLoaded(bumpAssets)
  const all = await listProjects()
  const legacyAvailable = (await legacyDatabaseExists().catch(() => false)) && !(await getKv<boolean>('legacyImported'))
  const lastId = await getKv<string>('lastProjectId')
  let project = all.find(p => p.id === lastId) ?? [...all].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (!project) {
    project = newProject('My App')
    await putProject(project)
    all.push(project)
  }
  setState({ projects: all.map(p => ops.projectMeta(upgradeProject(p))), legacyAvailable })
  await openLoaded(upgradeProject(project))
  setState({ ready: true })
}

/** Fills fields added after a document was saved, so older saves keep working. */
export function upgradeProject(project: Project): Project {
  const fill = (target: Record<string, unknown>, defaults: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(defaults)) {
      if (target[k] === undefined) target[k] = structuredClone(v)
      else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') fill(target[k] as Record<string, unknown>, v as Record<string, unknown>)
    }
  }
  const p = structuredClone(project)
  p.schemaVersion = SCHEMA_VERSION
  p.languages = p.languages?.length ? p.languages : ['en']
  p.defaultLanguage = p.defaultLanguage || p.languages[0]
  p.appName = p.appName ?? p.name
  for (const v of p.variants) {
    v.status = v.status ?? 'draft'
    v.hypothesis = v.hypothesis ?? ''
    for (const d of v.decks) {
      const dims = resolveDeckSize({ ...d, orientation: d.orientation ?? 'portrait' })
      d.orientation = d.orientation ?? (dims.width > dims.height ? 'landscape' : 'portrait')
      for (const s of d.screens) {
        fill(s.background as unknown as Record<string, unknown>, defaultBackground() as unknown as Record<string, unknown>)
        fill(s.device as unknown as Record<string, unknown>, defaultDevice(d.platformId) as unknown as Record<string, unknown>)
        fill(s.text as unknown as Record<string, unknown>, defaultText(dims.width, dims.height) as unknown as Record<string, unknown>)
        s.copy = s.copy ?? { headline: {}, subheadline: {} }
        s.images = s.images ?? {}
        s.elements = s.elements ?? []
        s.popouts = s.popouts ?? []
      }
    }
  }
  return p
}

async function openLoaded(project: Project) {
  const sel = normalizeSelection(project, project.lastSelection ?? { variantId: null, deckId: null, screenId: null, language: project.defaultLanguage })
  setState({ project: { ...project, lastSelection: sel }, sel, past: [], future: [], ui: { ...initialUi }, saveState: 'idle' })
  await setKv('lastProjectId', project.id)
  void ensureImages(ops.referencedAssets(project))
}

// ---------------------------------------------------------------- projects

export async function createProject(name: string, opts: { platformIds?: string[]; languages?: string[]; appName?: string } = {}): Promise<Project> {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) throw new Error('Project name must be 1-100 characters')
  opts.platformIds?.forEach(requirePlatform)
  const languages = opts.languages?.map(l => {
    if (!isValidLangCode(l)) throw new Error(`Invalid language code "${l}"`)
    return normalizeLang(l)
  })
  await flushSave()
  const project = newProject(trimmed, { ...opts, languages })
  await putProject(project)
  setState(s => ({ projects: [...s.projects, ops.projectMeta(project)] }))
  await openLoaded(project)
  return project
}

export async function openProject(id: string): Promise<Project> {
  if (getState().project?.id === id) return requireProject()
  const project = await getProject(id)
  if (!project) throw new Error(`Project "${id}" not found`)
  await flushSave()
  await openLoaded(upgradeProject(project))
  return requireProject()
}

export function renameProject(name: string, appName?: string): void {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) throw new Error('Project name must be 1-100 characters')
  mutate('Rename project', p => {
    p.name = trimmed
    if (appName !== undefined) p.appName = appName.trim()
  })
  const id = requireProject().id
  setState(s => ({ projects: s.projects.map(m => (m.id === id ? { ...m, name: trimmed } : m)) }))
}

export async function duplicateProject(id: string, name?: string): Promise<Project> {
  await flushSave()
  const source = getState().project?.id === id ? requireProject() : await getProject(id)
  if (!source) throw new Error(`Project "${id}" not found`)
  const copy = ops.cloneProject(upgradeProject(source), name?.trim() || `${source.name} copy`)
  await putProject(copy)
  setState(s => ({ projects: [...s.projects, ops.projectMeta(copy)] }))
  await openLoaded(copy)
  return copy
}

export async function deleteProject(id: string): Promise<void> {
  await flushSave()
  await deleteProjectRecord(id)
  const remaining = await listProjects()
  setState({ projects: remaining.map(ops.projectMeta) })
  if (getState().project?.id === id) {
    const next = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (next) await openLoaded(upgradeProject(next))
    else await createProject('My App')
  }
  const referenced = new Set<string>()
  for (const p of await listProjects()) for (const a of ops.referencedAssets(p)) referenced.add(a)
  await collectGarbageAssets(referenced)
}

export interface ProjectBundle {
  format: 'storedeck-project'
  version: number
  exportedAt: string
  project: Project
  assets: Record<string, { name: string; width: number; height: number; dataUrl: string }>
}

export async function exportProjectBundle(id?: string): Promise<ProjectBundle> {
  await flushSave()
  const project = id && id !== getState().project?.id ? await getProject(id) : requireProject()
  if (!project) throw new Error(`Project "${id}" not found`)
  const assets: ProjectBundle['assets'] = {}
  for (const v of project.variants) for (const d of v.decks) for (const s of d.screens) {
    for (const ref of Object.values(s.images)) if (ref) assets[ref.assetId] ??= { name: ref.name, width: ref.width, height: ref.height, dataUrl: '' }
    if (s.background.imageAssetId) assets[s.background.imageAssetId] ??= { name: 'background', width: 0, height: 0, dataUrl: '' }
    for (const el of s.elements) if (el.kind === 'image') assets[el.assetId] ??= { name: el.name, width: 0, height: 0, dataUrl: '' }
  }
  for (const [assetId, entry] of Object.entries(assets)) entry.dataUrl = await assetToDataUrl(assetId)
  return { format: 'storedeck-project', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), project, assets }
}

function remapAssetIds(project: Project, map: Map<string, string>) {
  const re = (id: string) => map.get(id) ?? id
  for (const v of project.variants) for (const d of v.decks) for (const s of d.screens) {
    for (const ref of Object.values(s.images)) if (ref) ref.assetId = re(ref.assetId)
    if (s.background.imageAssetId) s.background.imageAssetId = re(s.background.imageAssetId)
    for (const el of s.elements) if (el.kind === 'image') el.assetId = re(el.assetId)
  }
}

/** Imports a v3 bundle or a v1 backup file; returns the imported projects. */
export async function importProjectFile(json: unknown): Promise<Project[]> {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  const imported: Project[] = []
  if (data?.format === 'storedeck-project' && data.project) {
    const bundle = data as ProjectBundle
    const map = new Map<string, string>()
    for (const [oldId, a] of Object.entries(bundle.assets ?? {})) {
      const ref = await importDataUrl(a.dataUrl, a.name)
      map.set(oldId, ref.assetId)
    }
    const project = upgradeProject(bundle.project)
    remapAssetIds(project, map)
    const copy = ops.cloneProject(project, project.name)
    imported.push(copy)
  } else if (Array.isArray(data?.projects)) {
    const names = legacyNames(Array.isArray(data.meta) ? data.meta : [])
    for (const record of data.projects) {
      imported.push(await convertLegacyProject(record, names[record.id] ?? 'Imported project', (url, name) => importDataUrl(url, name)))
    }
  } else {
    throw new Error('Unrecognized file: expected a Storedeck project (.storedeck.json) or a v1 backup')
  }
  for (const p of imported) await putProject(p)
  setState(s => ({ projects: [...s.projects, ...imported.map(ops.projectMeta)] }))
  if (imported[0]) {
    await flushSave()
    await openLoaded(imported[0])
  }
  return imported
}

export async function importLegacyProjects(): Promise<number> {
  const dump = await readLegacyDatabase()
  const imported: Project[] = []
  for (const record of dump.projects) {
    const screenshots = (record as { screenshots?: unknown[] }).screenshots
    if (!Array.isArray(screenshots) || screenshots.length === 0) continue
    const name = dump.names[String(record.id)] ?? 'Imported project'
    imported.push(await convertLegacyProject(record, `${name} (v1)`, (url, n) => importDataUrl(url, n)))
  }
  for (const p of imported) await putProject(p)
  await setKv('legacyImported', true)
  setState(s => ({ legacyAvailable: false, projects: [...s.projects, ...imported.map(ops.projectMeta)] }))
  if (imported[0]) {
    await flushSave()
    await openLoaded(imported[0])
  }
  return imported.length
}

export async function dismissLegacyImport(): Promise<void> {
  await setKv('legacyImported', true)
  setState({ legacyAvailable: false })
}

// ---------------------------------------------------------------- variants (A/B)

export function addVariant(opts: { name?: string; cloneFromVariantId?: string; blank?: boolean; platformIds?: string[] } = {}): string {
  const project = requireProject()
  const name = opts.name?.trim() || `Variant ${String.fromCharCode(65 + project.variants.length)}`
  const id = mutate('Add variant', p => {
    let variant
    if (opts.blank) {
      const ids = opts.platformIds?.length ? opts.platformIds : [...new Set(p.variants[0]?.decks.map(d => d.platformId) ?? ['app-store-iphone'])]
      ids.forEach(requirePlatform)
      variant = { id: newId('var'), name, status: 'draft' as VariantStatus, hypothesis: '', createdAt: Date.now(), decks: [] as Project['variants'][number]['decks'] }
      for (const pid of ids) ops.addDeck(variant, pid)
    } else {
      const sourceId = opts.cloneFromVariantId ?? getState().sel.variantId ?? p.variants[0]?.id
      const source = p.variants.find(v => v.id === sourceId)
      if (!source) throw new Error(`Variant "${sourceId}" not found`)
      variant = ops.cloneVariant(source, name)
    }
    p.variants.push(variant)
    return variant.id
  })
  select({ variantId: id })
  return id
}

export function updateVariant(variantId: string, patch: { name?: string; status?: VariantStatus; hypothesis?: string }): void {
  const statuses: VariantStatus[] = ['draft', 'control', 'testing', 'winner', 'archived']
  if (patch.status && !statuses.includes(patch.status)) throw new Error(`status must be one of ${statuses.join(', ')}`)
  mutate('Update variant', p => {
    const v = ops.requireVariant(p, variantId)
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new Error('Variant name cannot be empty')
      v.name = patch.name.trim()
    }
    if (patch.hypothesis !== undefined) v.hypothesis = patch.hypothesis
    if (patch.status) {
      // Only one control and one winner at a time.
      if (patch.status === 'control' || patch.status === 'winner') {
        for (const other of p.variants) if (other.id !== v.id && other.status === patch.status) other.status = 'testing'
      }
      v.status = patch.status
    }
  })
}

export function deleteVariant(variantId: string): void {
  mutate('Delete variant', p => {
    if (p.variants.length <= 1) throw new Error('A project needs at least one variant')
    ops.requireVariant(p, variantId)
    p.variants = p.variants.filter(v => v.id !== variantId)
  })
}

export function moveVariant(variantId: string, toIndex: number): void {
  mutate('Reorder variants', p => {
    const from = p.variants.findIndex(v => v.id === variantId)
    if (from === -1) throw new Error(`Variant "${variantId}" not found`)
    ops.moveInArray(p.variants, from, toIndex)
  })
}

// ---------------------------------------------------------------- platform decks

export function addPlatform(platformId: string, opts: { variantId?: string; sizeId?: string; cloneFromDeckId?: string; allVariants?: boolean } = {}): string[] {
  requirePlatform(platformId)
  const created = mutate('Add platform', p => {
    const variantIds = opts.allVariants ? p.variants.map(v => v.id) : [opts.variantId ?? getState().sel.variantId ?? p.variants[0].id]
    const ids: string[] = []
    for (const vid of variantIds) {
      const variant = ops.requireVariant(p, vid)
      let cloneFrom = opts.cloneFromDeckId ? ops.requireDeck(p, opts.cloneFromDeckId).deck : undefined
      // When adding to several variants, clone each variant's own deck of the same source platform.
      if (cloneFrom && opts.allVariants) cloneFrom = variant.decks.find(d => d.platformId === cloneFrom!.platformId) ?? cloneFrom
      ids.push(ops.addDeck(variant, platformId, { sizeId: opts.sizeId, cloneFrom }).id)
    }
    return ids
  })
  const sel = getState().sel
  const mine = created.find(id => ops.findDeck(requireProject(), id)?.variant.id === sel.variantId) ?? created[0]
  select({ deckId: mine, variantId: ops.findDeck(requireProject(), mine)?.variant.id })
  return created
}

export function removePlatform(deckId: string): void {
  mutate('Remove platform', p => {
    const { variant } = ops.requireDeck(p, deckId)
    if (variant.decks.length <= 1) throw new Error('A variant needs at least one platform')
    variant.decks = variant.decks.filter(d => d.id !== deckId)
  })
}

export function setPlatformSize(deckId: string, patch: { sizeId?: string; width?: number; height?: number; orientation?: 'portrait' | 'landscape' }): string[] {
  const project = requireProject()
  const { deck } = ops.requireDeck(project, deckId)
  const platform = requirePlatform(deck.platformId)
  if (patch.sizeId && patch.sizeId !== 'custom' && !platform.sizes.some(s => s.id === patch.sizeId)) {
    throw new Error(`Size "${patch.sizeId}" is not available for ${platform.name}. Sizes: ${platform.sizes.map(s => s.id).join(', ')}, custom`)
  }
  if (patch.orientation && !platform.rotatable && patch.orientation !== (platform.orientation === 'landscape' ? 'landscape' : 'portrait')) {
    throw new Error(`${platform.name} only supports ${platform.orientation} screenshots`)
  }
  let warnings: string[] = []
  const custom = patch.width !== undefined || patch.height !== undefined
  if (custom) {
    const dims = resolveDeckSize(deck)
    const width = patch.width ?? dims.width
    const height = patch.height ?? dims.height
    warnings = validateSize(deck.platformId, width, height)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > 8000 || height > 8000) throw new Error(warnings[0])
    mutate('Change output size', p => ops.setDeckSize(ops.requireDeck(p, deckId).deck, { sizeId: 'custom', customSize: { width, height } }))
  } else {
    mutate('Change output size', p => ops.setDeckSize(ops.requireDeck(p, deckId).deck, { sizeId: patch.sizeId, orientation: patch.orientation }))
  }
  return warnings
}

// ---------------------------------------------------------------- screens

export interface UploadItem {
  name: string
  blob?: Blob
  dataUrl?: string
  language?: string
}

export interface UploadResult {
  name: string
  action: 'created-screen' | 'added-localized-image' | 'replaced-localized-image'
  screenId: string
  screenIndex: number
  language: string
  width: number
  height: number
}

/**
 * Adds screenshots to a deck. Files whose base name matches an existing
 * screen ("home_de.png" ↔ "home.png") become that screen's localized image.
 */
export async function uploadScreenshots(items: UploadItem[], opts: { deckId?: string; screenId?: string; language?: string } = {}): Promise<UploadResult[]> {
  const s = getState()
  const deckId = opts.deckId ?? s.sel.deckId
  if (!deckId) throw new Error('No platform selected')
  requireProject()
  const results: UploadResult[] = []
  for (const item of items) {
    const explicit = item.language ?? opts.language
    if (explicit && !isValidLangCode(explicit)) throw new Error(`Invalid language "${explicit}" for "${item.name}"`)
    const lang = normalizeLang(explicit ?? detectLanguageFromFilename(item.name) ?? getState().sel.language)
    const ref: AssetRef = item.blob ? await importImageBlob(item.blob, item.name) : item.dataUrl ? await importDataUrl(item.dataUrl, item.name) : (() => { throw new Error(`"${item.name}" has no image data`) })()
    const res = mutate('Upload screenshot', p => {
      ops.addLanguage(p, lang)
      const { deck } = ops.requireDeck(p, deckId)
      let index = opts.screenId ? deck.screens.findIndex(x => x.id === opts.screenId) : -1
      if (opts.screenId && index === -1) throw new Error(`Screen "${opts.screenId}" is not in this platform`)
      if (index === -1) {
        const base = baseFilename(item.name).toLowerCase()
        index = deck.screens.findIndex(x => Object.values(x.images).some(img => img && baseFilename(img.name).toLowerCase() === base))
      }
      if (index !== -1) {
        const screen = deck.screens[index]
        const existed = !!screen.images[lang]
        screen.images[lang] = ref
        return { action: existed ? 'replaced-localized-image' as const : 'added-localized-image' as const, screenId: screen.id, screenIndex: index }
      }
      const styleFrom = deck.screens.find(x => x.id === getState().sel.screenId) ?? deck.screens[deck.screens.length - 1]
      const screen = ops.screenForDeck(deck, baseFilename(item.name) || `Screen ${deck.screens.length + 1}`, styleFrom)
      screen.images[lang] = ref
      deck.screens.push(screen)
      return { action: 'created-screen' as const, screenId: screen.id, screenIndex: deck.screens.length - 1 }
    })
    results.push({ name: item.name, language: lang, width: ref.width, height: ref.height, ...res })
  }
  const last = results[results.length - 1]
  if (last) select({ deckId, screenId: last.screenId })
  return results
}

export function addBlankScreen(opts: { deckId?: string; name?: string } = {}): string {
  const deckId = opts.deckId ?? getState().sel.deckId
  if (!deckId) throw new Error('No platform selected')
  const id = mutate('Add screen', p => {
    const { deck } = ops.requireDeck(p, deckId)
    const styleFrom = deck.screens.find(x => x.id === getState().sel.screenId) ?? deck.screens[deck.screens.length - 1]
    const screen = ops.screenForDeck(deck, opts.name?.trim() || `Screen ${deck.screens.length + 1}`, styleFrom)
    deck.screens.push(screen)
    return screen.id
  })
  select({ deckId, screenId: id })
  return id
}

export function deleteScreen(screenId: string): void {
  mutate('Delete screen', p => {
    const { deck } = ops.requireScreen(p, screenId)
    deck.screens = deck.screens.filter(s => s.id !== screenId)
  })
}

export function duplicateScreen(screenId: string): string {
  const id = mutate('Duplicate screen', p => {
    const { deck, screen, index } = ops.requireScreen(p, screenId)
    const copy = ops.cloneScreen(screen, `${screen.name} copy`)
    deck.screens.splice(index + 1, 0, copy)
    return copy.id
  })
  select({ screenId: id })
  return id
}

export function moveScreen(screenId: string, toIndex: number): void {
  mutate('Reorder screens', p => {
    const { deck, index } = ops.requireScreen(p, screenId)
    ops.moveInArray(deck.screens, index, toIndex)
  })
}

export function renameScreen(screenId: string, name: string): void {
  if (!name.trim()) throw new Error('Screen name cannot be empty')
  mutate('Rename screen', p => {
    ops.requireScreen(p, screenId).screen.name = name.trim()
  })
}

export function removeScreenImage(screenId: string, lang: string): void {
  mutate('Remove image', p => {
    const { screen } = ops.requireScreen(p, screenId)
    delete screen.images[normalizeLang(lang)]
  })
}

// ---------------------------------------------------------------- design

export const CHROME_STYLES: ChromeStyle[] = ['none', 'phone', 'tablet', 'laptop', 'monitor', 'browser', 'window', 'tv', 'watch']

/** Resolves screen ids from explicit ids, a whole deck, or the selection. */
export function targetScreens(opts: { screenIds?: string[]; deckId?: string; allInDeck?: boolean; allInVariant?: boolean }): string[] {
  const project = requireProject()
  if (opts.screenIds?.length) {
    opts.screenIds.forEach(id => ops.requireScreen(project, id))
    return opts.screenIds
  }
  const sel = getState().sel
  if (opts.allInVariant) {
    const v = ops.requireVariant(project, sel.variantId ?? project.variants[0].id)
    return v.decks.flatMap(d => d.screens.map(s => s.id))
  }
  if (opts.allInDeck || opts.deckId) {
    const { deck } = ops.requireDeck(project, opts.deckId ?? sel.deckId ?? '')
    return deck.screens.map(s => s.id)
  }
  if (!sel.screenId) throw new Error('No screen selected — upload a screenshot or add a screen first')
  return [sel.screenId]
}

export function updateScreens(screenIds: string[], label: string, fn: (screen: Screen) => void, coalesceKey?: string): void {
  mutate(label, p => {
    for (const id of screenIds) fn(ops.requireScreen(p, id).screen)
  }, { coalesceKey })
}

export function setBackground(screenIds: string[], patch: ops.DeepPartial<Background>, coalesceKey?: string): void {
  updateScreens(screenIds, 'Background', s => ops.applyBackgroundPatch(s.background, structuredClone(patch)), coalesceKey)
}

export function setDevice(screenIds: string[], patch: ops.DeepPartial<DeviceSettings>, preset?: PositionPresetId, coalesceKey?: string): void {
  if (patch.model3D !== undefined && !['iphone', 'samsung'].includes(patch.model3D)) {
    throw new Error(`model3D must be "iphone" or "samsung"`)
  }
  const chrome = patch.chrome?.style
  if (chrome !== undefined && !CHROME_STYLES.includes(chrome)) throw new Error(`chrome.style must be one of ${CHROME_STYLES.join(', ')}`)
  updateScreens(screenIds, 'Device', s => ops.applyDevicePatch(s.device, structuredClone(patch), preset), coalesceKey)
}

export function setTextStyle(screenIds: string[], patch: ops.TextPatch, language?: string, coalesceKey?: string): void {
  if (language && !isValidLangCode(language)) throw new Error(`Invalid language "${language}"`)
  updateScreens(screenIds, 'Text style', s => ops.applyTextPatch(s.text, structuredClone(patch), language), coalesceKey)
}

export function clearLanguageOverride(screenIds: string[], language: string): void {
  updateScreens(screenIds, 'Reset language layout', s => {
    delete s.text.languageOverrides[normalizeLang(language)]
  })
}

export function applyLayoutPreset(screenIds: string[], preset: PositionPresetId): void {
  updateScreens(screenIds, 'Layout preset', s => {
    ops.applyDevicePatch(s.device, {}, preset)
  })
}

export interface CopyEntry {
  screenId: string
  field: ops.StringField
  language: string
  text: string
}

export function setCopy(entries: CopyEntry[], coalesceKey?: string): { applied: number; errors: string[]; addedLanguages: string[] } {
  const errors: string[] = []
  let applied = 0
  const addedLanguages: string[] = []
  mutate('Edit copy', p => {
    entries.forEach((e, i) => {
      if (!isValidLangCode(e.language)) return void errors.push(`#${i}: invalid language "${e.language}"`)
      if (typeof e.text !== 'string' || e.text.length > 1000) return void errors.push(`#${i}: text must be a string up to 1000 chars`)
      const loc = ops.findScreen(p, e.screenId)
      if (!loc) return void errors.push(`#${i}: screen "${e.screenId}" not found`)
      try {
        ops.setString(loc.screen, e.field, e.language, e.text)
        if (ops.addLanguage(p, e.language)) addedLanguages.push(normalizeLang(e.language))
        applied++
      } catch (err) {
        errors.push(`#${i}: ${(err as Error).message}`)
      }
    })
  }, { coalesceKey })
  return { applied, errors, addedLanguages }
}

export function copyStringsBetweenDecks(fromDeckId: string, toDeckId: string, languages?: string[]): number {
  return mutate('Copy strings', p => ops.copyStrings(ops.requireDeck(p, fromDeckId).deck, ops.requireDeck(p, toDeckId).deck, languages?.map(normalizeLang)))
}

export function transferStyle(sourceScreenId: string, targetScreenIds: string[], opts: ops.TransferOptions = {}): number {
  return mutate('Transfer style', p => {
    const src = ops.requireScreen(p, sourceScreenId)
    const fromDims = resolveDeckSize(src.deck)
    let n = 0
    for (const id of targetScreenIds) {
      if (id === sourceScreenId) continue
      const t = ops.requireScreen(p, id)
      const toDims = resolveDeckSize(t.deck)
      ops.transferStyle(src.screen, t.screen, opts, { from: fromDims, to: toDims, platformId: t.deck.platformId })
      n++
    }
    return n
  })
}

// ---------------------------------------------------------------- elements

export function addElement(screenId: string, element: CanvasElement): string {
  mutate('Add element', p => {
    ops.requireScreen(p, screenId).screen.elements.push(element)
  })
  setState(s => ({ ui: { ...s.ui, selectedElementId: element.id, inspectorTab: 'elements' } }))
  return element.id
}

export function addTextElement(screenId: string, text: string, lang?: string): string {
  return addElement(screenId, newTextElement(text, lang ?? getState().sel.language))
}

export function updateElement(screenId: string, elementId: string, patch: Record<string, unknown>, coalesceKey?: string): void {
  mutate('Edit element', p => {
    const { screen } = ops.requireScreen(p, screenId)
    const el = screen.elements.find(e => e.id === elementId)
    if (!el) throw new Error(`Element "${elementId}" not found on screen ${screenId}`)
    if ('kind' in patch || 'id' in patch) throw new Error('kind and id cannot be changed')
    for (const key of ['color', 'frameColor'] as const) ops.assertHex(patch[key], key)
    if (patch.layer !== undefined && !['behind-device', 'above-device', 'above-text'].includes(String(patch.layer))) {
      throw new Error('layer must be behind-device, above-device or above-text')
    }
    ops.deepAssign(el as unknown as Record<string, unknown>, structuredClone(patch))
  }, { coalesceKey })
}

export function deleteElement(screenId: string, elementId: string): void {
  mutate('Delete element', p => {
    const { screen } = ops.requireScreen(p, screenId)
    if (!screen.elements.some(e => e.id === elementId)) throw new Error(`Element "${elementId}" not found`)
    screen.elements = screen.elements.filter(e => e.id !== elementId)
  })
  setState(s => ({ ui: { ...s.ui, selectedElementId: s.ui.selectedElementId === elementId ? null : s.ui.selectedElementId } }))
}

export function reorderElement(screenId: string, elementId: string, toIndex: number): void {
  mutate('Reorder elements', p => {
    const { screen } = ops.requireScreen(p, screenId)
    const from = screen.elements.findIndex(e => e.id === elementId)
    if (from === -1) throw new Error(`Element "${elementId}" not found`)
    ops.moveInArray(screen.elements, from, toIndex)
  })
}

// ---------------------------------------------------------------- popouts

export function addPopout(screenId: string, patch: Partial<Popout> = {}): string {
  const popout = { ...newPopout(), ...patch, id: newId('pop') }
  mutate('Add popout', p => {
    const { screen } = ops.requireScreen(p, screenId)
    if (!Object.keys(screen.images).length) throw new Error('Popouts crop the screenshot — upload an image for this screen first')
    screen.popouts.push(popout)
  })
  setState(s => ({ ui: { ...s.ui, selectedPopoutId: popout.id, inspectorTab: 'popouts' } }))
  return popout.id
}

export function updatePopout(screenId: string, popoutId: string, patch: ops.DeepPartial<Popout>, coalesceKey?: string): void {
  mutate('Edit popout', p => {
    const { screen } = ops.requireScreen(p, screenId)
    const po = screen.popouts.find(x => x.id === popoutId)
    if (!po) throw new Error(`Popout "${popoutId}" not found on screen ${screenId}`)
    if ('id' in patch) throw new Error('id cannot be changed')
    ops.assertHex(patch.shadow?.color, 'shadow.color')
    ops.assertHex(patch.border?.color, 'border.color')
    ops.deepAssign(po as unknown as Record<string, unknown>, structuredClone(patch) as Record<string, unknown>)
    po.cropX = Math.min(99, Math.max(0, po.cropX))
    po.cropY = Math.min(99, Math.max(0, po.cropY))
    po.cropWidth = Math.min(100 - po.cropX, Math.max(1, po.cropWidth))
    po.cropHeight = Math.min(100 - po.cropY, Math.max(1, po.cropHeight))
  }, { coalesceKey })
}

export function deletePopout(screenId: string, popoutId: string): void {
  mutate('Delete popout', p => {
    const { screen } = ops.requireScreen(p, screenId)
    screen.popouts = screen.popouts.filter(x => x.id !== popoutId)
  })
}

// ---------------------------------------------------------------- languages

export function addLanguages(langs: string[]): string[] {
  const added: string[] = []
  mutate('Add language', p => {
    for (const l of langs) {
      if (!isValidLangCode(l)) throw new Error(`Invalid language code "${l}"`)
      if (ops.addLanguage(p, l)) added.push(normalizeLang(l))
    }
  })
  return added
}

export function removeLanguage(lang: string): void {
  mutate('Remove language', p => ops.removeLanguage(p, lang))
}

export function setDefaultLanguage(lang: string): void {
  mutate('Default language', p => {
    const code = normalizeLang(lang)
    if (!p.languages.includes(code)) throw new Error(`"${code}" is not a project language`)
    p.defaultLanguage = code
  })
}

export function switchLanguage(lang: string): Selection {
  const code = normalizeLang(lang)
  const project = requireProject()
  if (!project.languages.includes(code)) throw new Error(`"${code}" is not in this project (${project.languages.join(', ')}). Add it first.`)
  return select({ language: code })
}

export function currentScreenOrThrow(): Screen {
  const c = current()
  if (!c.screen) throw new Error('No screen selected')
  return c.screen
}

export { toast }
export type { TextSettings }
