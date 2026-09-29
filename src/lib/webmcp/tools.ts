// WebMCP tool implementations. Each tool validates input against its spec,
// runs through the same actions as the UI (so undo, autosave and the canvas
// all stay in sync) and returns compact JSON for the agent.

import * as A from '../editor/actions'
import { current, getState, redo, requireProject, select, setState, setUi, undo, type EditorUi } from '../editor/store'
import { GRADIENT_PRESETS, POSITION_PRESETS, newId, newTextElement, type PositionPresetId } from '../model/defaults'
import { getLanguage, isValidLangCode, normalizeLang } from '../model/languages'
import * as ops from '../model/ops'
import { getPlatform, PLATFORMS, resolveDeckSize, SPEC_REVIEWED, STORES } from '../model/platforms'
import type { CanvasElement, PlatformDeck, Project, Screen } from '../model/types'
import { chromeBounds, deviceRect, layoutText, screenFontSpecs } from '../render/canvas'
import { ensureFonts, googleFamilyOf, loadGoogleFont } from '../render/fonts'
import { iconExists } from '../render/icons'
import { canvasToBlob, canvasToDataUrl, downloadBlob, exportZip, planExport, renderScreenImage, slug } from '../render/service'
import { MODEL_COLOR_PRESETS } from '../render/three-presets'
import { assetToDataUrl, ensureImage, importDataUrl } from '../storage/assets'
import { validate } from './schema'
import { TOOL_SPECS, type ToolSpec } from './specs'

export interface ToolContext {
  signal?: AbortSignal
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = Record<string, any>
type Impl = (input: Input, ctx: ToolContext) => Promise<unknown>

export interface ToolDefinition extends ToolSpec {
  execute: (input: unknown, ctx?: ToolContext) => Promise<unknown>
}

// ---------------------------------------------------------------- environment

let ensureEditorHook: (() => Promise<void>) | null = null

/** The app registers how to bring the editor on screen (navigate + init). */
export function setEnsureEditor(fn: () => Promise<void>): void {
  ensureEditorHook = fn
}

async function ensureEditor() {
  if (ensureEditorHook) await ensureEditorHook()
  else await A.initEditor()
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

// ---------------------------------------------------------------- resolution helpers

function deckOrSelected(project: Project, deckId?: string): PlatformDeck {
  const id = deckId ?? getState().sel.deckId
  if (!id) throw new Error('No platform selected — add one with manage_platform action=add')
  return ops.requireDeck(project, id).deck
}

function resolveScreenId(input: { screenId?: string; screenIndex?: number; deckId?: string }): string {
  const project = requireProject()
  if (input.screenId) {
    ops.requireScreen(project, input.screenId)
    return input.screenId
  }
  if (typeof input.screenIndex === 'number') {
    const deck = deckOrSelected(project, input.deckId)
    const s = deck.screens[input.screenIndex]
    if (!s) throw new Error(`screenIndex ${input.screenIndex} is out of range (platform has ${deck.screens.length} screens)`)
    return s.id
  }
  const sel = getState().sel.screenId
  if (!sel) throw new Error('No screen selected — upload screenshots with manage_screens action=upload or add one with action=add_blank')
  return sel
}

/** Resolves design-tool targets; single targets are focused so the user sees the change. */
function resolveTargets(input: Input): string[] {
  const project = requireProject()
  if (input.screenIds?.length) {
    input.screenIds.forEach((id: string) => ops.requireScreen(project, id))
    return input.screenIds
  }
  if (input.scope === 'platform') {
    const deck = deckOrSelected(project, input.deckId)
    if (!deck.screens.length) throw new Error('This platform has no screens yet')
    return deck.screens.map(s => s.id)
  }
  if (input.scope === 'variant') {
    const variantId = input.deckId ? ops.requireDeck(project, input.deckId).variant.id : getState().sel.variantId
    const variant = ops.requireVariant(project, variantId ?? '')
    const ids = variant.decks.flatMap(d => d.screens.map(s => s.id))
    if (!ids.length) throw new Error('This variant has no screens yet')
    return ids
  }
  const id = resolveScreenId(input)
  focusScreen(id)
  return [id]
}

function focusScreen(screenId: string) {
  const loc = ops.findScreen(requireProject(), screenId)
  if (loc && getState().sel.screenId !== screenId) select({ variantId: loc.variant.id, deckId: loc.deck.id, screenId })
}

function screenLoc(screenId: string) {
  return ops.requireScreen(requireProject(), screenId)
}

// ---------------------------------------------------------------- serializers

function truncate(s: string, n = 160) {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

function screenSummary(screen: Screen, index: number, includeCopy: boolean) {
  const out: Record<string, unknown> = {
    id: screen.id,
    index,
    name: screen.name,
    imageLanguages: Object.keys(screen.images),
    elements: screen.elements.length,
    popouts: screen.popouts.length,
    device: screen.device.use3D ? `3d:${screen.device.model3D}` : `2d:${screen.device.chrome.style}`,
  }
  if (includeCopy) {
    out.headline = Object.fromEntries(Object.entries(screen.copy.headline).map(([k, v]) => [k, truncate(v)]))
    out.subheadline = Object.fromEntries(Object.entries(screen.copy.subheadline).map(([k, v]) => [k, truncate(v)]))
  }
  return out
}

function deckSummary(deck: PlatformDeck, includeCopy: boolean) {
  const platform = getPlatform(deck.platformId)
  const size = resolveDeckSize(deck)
  return {
    id: deck.id,
    platformId: deck.platformId,
    platform: platform?.name,
    store: platform?.store,
    sizeId: deck.sizeId,
    width: size.width,
    height: size.height,
    orientation: deck.orientation,
    screenCount: deck.screens.length,
    storeLimits: platform?.screenshots,
    screens: deck.screens.map((s, i) => screenSummary(s, i, includeCopy)),
  }
}

function hints(project: Project): string[] {
  const out: string[] = []
  const sel = getState().sel
  const deck = sel.deckId ? ops.findDeck(project, sel.deckId)?.deck : undefined
  if (deck && !deck.screens.length) out.push('The selected platform has no screens: upload screenshots with manage_screens action=upload.')
  if (deck) {
    const platform = getPlatform(deck.platformId)
    if (platform && deck.screens.length && deck.screens.length < platform.screenshots.min) out.push(`${platform.name} needs at least ${platform.screenshots.min} screenshots (has ${deck.screens.length}).`)
    if (platform?.screenshots.max && deck.screens.length > platform.screenshots.max) out.push(`${platform.name} accepts at most ${platform.screenshots.max} screenshots (has ${deck.screens.length}).`)
    const noCopy = deck.screens.filter(s => !Object.values(s.copy.headline).some(v => v.trim())).length
    if (noCopy) out.push(`${noCopy} screen(s) have no headline: write copy with set_copy after looking at them with get_images mode=original.`)
  }
  const missing = ops.missingTranslations(project, ops.collectStrings(project))
  if (missing.length && project.languages.length > 1) out.push(`${missing.length} string(s) miss translations — see get_strings onlyMissing=true.`)
  if (!out.length) out.push('Review with get_images (rendered), then export.')
  return out
}

// ---------------------------------------------------------------- layout QA

function verticalGap(a: { y: number; h: number }, b: { y: number; h: number }) {
  return a.y + a.h <= b.y ? b.y - (a.y + a.h) : b.y + b.h <= a.y ? a.y - (b.y + b.h) : 0
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

async function layoutReport(screen: Screen, deck: PlatformDeck, project: Project, lang: string) {
  const size = resolveDeckSize(deck)
  await ensureFonts(screenFontSpecs(screen)).catch(() => undefined)
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return { warnings: [] as string[] }
  const chain = ops.fallbackChain(project, lang)
  const text = layoutText(ctx, screen, size.width, size.height, lang, chain)
  const img = ops.screenImage(screen, chain)
  const round = (r: { x: number; y: number; w: number; h: number }) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) })
  const screenRect = img || screen.device.chrome.style !== 'none' ? deviceRect(img ? img.height / img.width : size.height / size.width, size.width, size.height, screen.device) : null
  const device = screenRect && (screen.device.use3D ? screenRect : chromeBounds(screen.device.chrome.style, screenRect))
  const warnings: string[] = []
  if (text.bounds) {
    const b = text.bounds
    if (b.y < 0 || b.y + b.h > size.height) warnings.push('Text runs off the top/bottom of the canvas — reduce size or offsetY.')
    if (b.x < -1 || b.x + b.w > size.width + 1) warnings.push('Text is wider than the canvas.')
    if (device && !screen.device.use3D && screen.device.rotation === 0) {
      // Any overlap with the device frame reads as a collision; allow a hair of tolerance.
      const overlap = intersects(b, device)
      if (overlap > b.w * 2) warnings.push(`Text overlaps the device by ~${Math.round(Math.min(b.y + b.h - device.y, device.y + device.h - b.y))}px — lower the device (y) or scale, raise/shrink the text (offsetY, size), or move text to the other edge.`)
      else if (verticalGap(b, device) < size.height * 0.012) warnings.push('Text is very close to the device — consider more breathing room.')
    }
    const lines = text.lines.filter(l => l.kind === 'headline').length
    if (lines > 3) warnings.push(`Headline wraps to ${lines} lines — shorten it or reduce the size for this language.`)
  }
  if (screen.text.headline.enabled && !screen.copy.headline[lang]?.trim() && Object.values(screen.copy.headline).some(v => v.trim())) {
    warnings.push(`No ${lang} headline — the ${project.defaultLanguage} fallback is shown.`)
  }
  if (!img) warnings.push('No screenshot image for this screen.')
  else if (!screen.images[lang]) warnings.push(`No ${lang} screenshot — using another language's image.`)
  return { output: size, deviceRect: device && round(device), screenshotRect: screenRect && round(screenRect), textRect: text.bounds && round(text.bounds), headlineLines: text.lines.filter(l => l.kind === 'headline').length, warnings }
}

function screenDetail(screen: Screen) {
  return {
    id: screen.id,
    name: screen.name,
    images: Object.fromEntries(Object.entries(screen.images).map(([l, r]) => [l, { name: r.name, width: r.width, height: r.height }])),
    copy: screen.copy,
    background: screen.background,
    device: screen.device,
    text: screen.text,
    elements: screen.elements,
    popouts: screen.popouts,
  }
}

// ---------------------------------------------------------------- images

async function originalDataUrl(assetId: string, maxDimension: number, format: 'jpeg' | 'png') {
  const img = await ensureImage(assetId)
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= maxDimension && format === 'png') {
    return { dataUrl: await assetToDataUrl(assetId), width: img.naturalWidth, height: img.naturalHeight }
  }
  const k = Math.min(1, maxDimension / longest)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * k))
  c.height = Math.max(1, Math.round(img.naturalHeight * k))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return { dataUrl: c.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.85), width: c.width, height: c.height }
}

function kb(dataUrl: string) {
  return Math.round((dataUrl.length * 0.75) / 1024)
}

// ---------------------------------------------------------------- implementations

const impl: Record<string, Impl> = {
  async get_app_state({ variantId, includeCopy = true }) {
    const project = requireProject()
    const s = getState()
    const c = current()
    return {
      app: 'storedeck',
      project: {
        id: project.id,
        name: project.name,
        appName: project.appName,
        languages: project.languages.map(code => ({ code, name: getLanguage(code).name })),
        defaultLanguage: project.defaultLanguage,
      },
      projects: s.projects.map(p => ({ id: p.id, name: p.name, variants: p.variantCount, screens: p.screenCount, open: p.id === project.id })),
      selection: { variantId: s.sel.variantId, deckId: s.sel.deckId, screenId: s.sel.screenId, screenIndex: c.screenIndex, language: s.sel.language },
      view: { view: s.ui.view, inspectorTab: s.ui.inspectorTab, selectedElementId: s.ui.selectedElementId, selectedPopoutId: s.ui.selectedPopoutId },
      variants: project.variants
        .filter(v => !variantId || v.id === variantId)
        .map(v => ({ id: v.id, name: v.name, status: v.status, hypothesis: v.hypothesis, selected: v.id === s.sel.variantId, decks: v.decks.map(d => deckSummary(d, includeCopy)) })),
      history: { canUndo: s.past.length > 0, undo: s.past[s.past.length - 1]?.label ?? null, canRedo: s.future.length > 0, redo: s.future[0]?.label ?? null },
      hints: hints(project),
    }
  },

  async get_screen(input) {
    const project = requireProject()
    const id = resolveScreenId(input)
    const { deck, variant, screen, index } = screenLoc(id)
    const lang = input.language ? normalizeLang(input.language) : getState().sel.language
    const platform = getPlatform(deck.platformId)
    return {
      variantId: variant.id,
      deckId: deck.id,
      platform: platform?.name,
      index,
      screen: screenDetail(screen),
      layout: await layoutReport(screen, deck, project, lang),
    }
  },

  async get_platform_catalog({ store }) {
    return {
      reviewed: SPEC_REVIEWED,
      stores: STORES.filter(s => !store || s.id === store).map(s => ({ id: s.id, name: s.name, source: s.sourceUrl })),
      platforms: PLATFORMS.filter(p => !store || p.store === store).map(p => ({
        id: p.id,
        store: p.store,
        name: p.name,
        category: p.category,
        orientation: p.orientation,
        rotatable: p.rotatable,
        defaultSizeId: p.defaultSizeId,
        sizes: p.sizes.map(s => ({ id: s.id, label: s.label, width: s.width, height: s.height })),
        screenshots: p.screenshots,
        formats: p.formats,
        requirements: p.requirements,
        models3D: p.models3D,
        defaultChrome: p.defaultChrome,
      })),
    }
  },

  async get_strings({ variantId, deckId, languages, onlyMissing }) {
    const project = requireProject()
    const langs: string[] = languages?.length ? languages.map(normalizeLang) : project.languages
    let rows = ops.collectStrings(project, { variantId, deckId })
    const missing = ops.missingTranslations(project, rows)
    if (onlyMissing) {
      const keys = new Set(missing.map(m => `${m.screenId}|${m.field}`))
      rows = rows.filter(r => keys.has(`${r.screenId}|${r.field}`))
    }
    return {
      languages: langs,
      defaultLanguage: project.defaultLanguage,
      rows: rows.map(r => ({ ...r, values: Object.fromEntries(langs.map(l => [l, r.values[l] ?? ''])) })),
      missing,
    }
  },

  async get_images(input, { signal }) {
    const project = requireProject()
    const lang = normalizeLang(input.language ?? getState().sel.language)
    if (!project.languages.includes(lang)) throw new Error(`Language "${lang}" is not in the project (${project.languages.join(', ')})`)
    const mode = input.mode ?? 'rendered'
    const maxDimension = input.maxDimension ?? 900
    const format: 'jpeg' | 'png' = input.format ?? 'jpeg'
    const ids = resolveTargets(input).slice(0, input.maxImages ?? 6)
    const images = []
    for (const id of ids) {
      checkAborted(signal)
      const { screen, deck, index } = screenLoc(id)
      if (mode === 'original') {
        const ref = ops.screenImage(screen, ops.fallbackChain(project, lang))
        if (!ref) {
          images.push({ screenId: id, index, name: screen.name, error: 'No image uploaded' })
          continue
        }
        const out = await originalDataUrl(ref.assetId, maxDimension, format)
        images.push({ screenId: id, index, name: screen.name, language: screen.images[lang] ? lang : 'fallback', ...out, sizeKB: kb(out.dataUrl) })
      } else {
        const r = await renderScreenImage(screen, deck, project, lang, { maxDimension, signal })
        const dataUrl = canvasToDataUrl(r.canvas, format)
        images.push({ screenId: id, index, name: screen.name, language: lang, width: r.width, height: r.height, outputWidth: r.outputWidth, outputHeight: r.outputHeight, sizeKB: kb(dataUrl), dataUrl })
      }
    }
    return { mode, language: lang, count: images.length, images }
  },

  async select(input) {
    const project = requireProject()
    const partial: Record<string, unknown> = {}
    if (input.variantId) partial.variantId = ops.requireVariant(project, input.variantId).id
    if (input.deckId) {
      const d = ops.requireDeck(project, input.deckId)
      partial.deckId = d.deck.id
      partial.variantId = d.variant.id
    }
    if (input.screenId || typeof input.screenIndex === 'number') {
      const deckForIndex = (partial.deckId as string | undefined) ?? input.deckId
      const id = resolveScreenId({ screenId: input.screenId, screenIndex: input.screenIndex, deckId: deckForIndex })
      const loc = screenLoc(id)
      Object.assign(partial, { variantId: loc.variant.id, deckId: loc.deck.id, screenId: id })
    }
    if (input.language) {
      const code = normalizeLang(input.language)
      if (!project.languages.includes(code)) throw new Error(`"${code}" is not a project language (${project.languages.join(', ')}); add it with manage_languages`)
      partial.language = code
    }
    const sel = select(partial)
    return { selection: sel, screenIndex: current().screenIndex }
  },

  async set_view(input) {
    const patch: Partial<EditorUi> = {}
    if (input.view) patch.view = input.view
    if (input.inspectorTab) patch.inspectorTab = input.inspectorTab
    if (input.selectedElementId !== undefined) patch.selectedElementId = input.selectedElementId || null
    if (input.selectedPopoutId !== undefined) patch.selectedPopoutId = input.selectedPopoutId || null
    if (input.compareVariantIds) {
      input.compareVariantIds.forEach((id: string) => ops.requireVariant(requireProject(), id))
      patch.compareVariantIds = input.compareVariantIds
    }
    if (input.showSafeArea !== undefined) patch.showSafeArea = input.showSafeArea
    setUi(patch)
    return { view: getState().ui }
  },

  async manage_project(input) {
    const { action } = input
    if (action === 'create') {
      if (!input.name) throw new Error('create requires name')
      const p = await A.createProject(input.name, { appName: input.appName, platformIds: input.platformIds, languages: input.languages })
      return { success: true, projectId: p.id, variantId: p.variants[0].id, deckIds: p.variants[0].decks.map(d => d.id) }
    }
    if (action === 'open') {
      if (!input.projectId) throw new Error('open requires projectId')
      const p = await A.openProject(input.projectId)
      return { success: true, projectId: p.id, name: p.name }
    }
    if (action === 'rename') {
      if (!input.name) throw new Error('rename requires name')
      A.renameProject(input.name, input.appName)
      return { success: true }
    }
    if (action === 'duplicate') {
      const p = await A.duplicateProject(input.projectId ?? requireProject().id, input.name)
      return { success: true, projectId: p.id, name: p.name }
    }
    if (action === 'delete') {
      if (!input.projectId) throw new Error('delete requires projectId')
      if (input.confirm !== true) throw new Error('delete is permanent — pass confirm: true after the user agreed')
      await A.deleteProject(input.projectId)
      return { success: true, openProjectId: requireProject().id }
    }
    if (action === 'export_file') {
      const bundle = await A.exportProjectBundle(input.projectId)
      const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' })
      downloadBlob(blob, `${slug(bundle.project.name)}.storedeck.json`)
      return { success: true, downloaded: `${slug(bundle.project.name)}.storedeck.json`, assets: Object.keys(bundle.assets).length, sizeKB: Math.round(blob.size / 1024) }
    }
    if (action === 'import_file') {
      if (input.bundle === undefined) throw new Error('import_file requires bundle')
      const imported = await A.importProjectFile(input.bundle)
      return { success: true, imported: imported.map(p => ({ id: p.id, name: p.name })) }
    }
    throw new Error(`Unknown action "${action}"`)
  },

  async manage_variant(input) {
    const { action } = input
    if (action === 'create') {
      const id = A.addVariant({ name: input.name, cloneFromVariantId: input.cloneFromVariantId, blank: input.blank, platformIds: input.platformIds })
      if (input.hypothesis || input.status) A.updateVariant(id, { hypothesis: input.hypothesis, status: input.status })
      const v = ops.requireVariant(requireProject(), id)
      return { success: true, variantId: id, name: v.name, decks: v.decks.map(d => ({ id: d.id, platformId: d.platformId, screens: d.screens.map(s => s.id) })) }
    }
    if (!input.variantId) throw new Error(`${action} requires variantId`)
    if (action === 'update') {
      A.updateVariant(input.variantId, { name: input.name, status: input.status, hypothesis: input.hypothesis })
      const v = ops.requireVariant(requireProject(), input.variantId)
      return { success: true, variant: { id: v.id, name: v.name, status: v.status, hypothesis: v.hypothesis } }
    }
    if (action === 'delete') {
      A.deleteVariant(input.variantId)
      return { success: true, remaining: requireProject().variants.map(v => v.id) }
    }
    if (action === 'move') {
      if (typeof input.toIndex !== 'number') throw new Error('move requires toIndex')
      A.moveVariant(input.variantId, input.toIndex)
      return { success: true, order: requireProject().variants.map(v => v.id) }
    }
    throw new Error(`Unknown action "${action}"`)
  },

  async manage_platform(input) {
    const { action } = input
    if (action === 'add') {
      if (!input.platformId) throw new Error('add requires platformId')
      const ids = A.addPlatform(input.platformId, { variantId: input.variantId, sizeId: input.sizeId, cloneFromDeckId: input.cloneFromDeckId, allVariants: input.allVariants })
      const project = requireProject()
      return { success: true, decks: ids.map(id => deckSummary(ops.requireDeck(project, id).deck, false)) }
    }
    if (action === 'remove') {
      if (!input.deckId) throw new Error('remove requires deckId')
      A.removePlatform(input.deckId)
      return { success: true }
    }
    if (action === 'set_size') {
      const deck = deckOrSelected(requireProject(), input.deckId)
      if (!input.sizeId && input.width === undefined && input.height === undefined && !input.orientation) throw new Error('set_size requires sizeId, width/height or orientation')
      const warnings = A.setPlatformSize(deck.id, { sizeId: input.sizeId === 'custom' ? undefined : input.sizeId, width: input.width, height: input.height, orientation: input.orientation })
      const size = resolveDeckSize(ops.requireDeck(requireProject(), deck.id).deck)
      return { success: true, deckId: deck.id, width: size.width, height: size.height, warnings }
    }
    throw new Error(`Unknown action "${action}"`)
  },

  async manage_screens(input, { signal }) {
    const { action } = input
    if (action === 'upload') {
      if (!input.screenshots?.length) throw new Error('upload requires screenshots')
      const deckId = input.deckId ?? getState().sel.deckId ?? undefined
      const results = []
      for (const item of input.screenshots) {
        checkAborted(signal)
        if (item.language && !isValidLangCode(item.language)) throw new Error(`Invalid language "${item.language}" for ${item.filename}`)
        results.push(...(await A.uploadScreenshots([{ name: item.filename, dataUrl: item.dataUrl, language: item.language ?? input.language }], { deckId, screenId: input.screenId })))
      }
      return { success: true, results, screens: deckOrSelected(requireProject(), deckId).screens.length }
    }
    if (action === 'add_blank') {
      const id = A.addBlankScreen({ deckId: input.deckId, name: input.name })
      return { success: true, screenId: id }
    }
    const screenId = resolveScreenId(input)
    if (action === 'delete') {
      A.deleteScreen(screenId)
      return { success: true, removed: screenId }
    }
    if (action === 'duplicate') return { success: true, screenId: A.duplicateScreen(screenId) }
    if (action === 'move') {
      if (typeof input.toIndex !== 'number') throw new Error('move requires toIndex')
      A.moveScreen(screenId, input.toIndex)
      return { success: true, order: screenLoc(screenId).deck.screens.map(s => ({ id: s.id, name: s.name })) }
    }
    if (action === 'rename') {
      if (!input.name) throw new Error('rename requires name')
      A.renameScreen(screenId, input.name)
      return { success: true }
    }
    if (action === 'remove_image') {
      if (!input.language) throw new Error('remove_image requires language')
      A.removeScreenImage(screenId, input.language)
      return { success: true }
    }
    throw new Error(`Unknown action "${action}"`)
  },

  async manage_languages(input) {
    const { action } = input
    if (action === 'add') {
      const langs: string[] = input.languages ?? (input.language ? [input.language] : [])
      if (!langs.length) throw new Error('add requires languages')
      const added = A.addLanguages(langs)
      return { success: true, added, languages: requireProject().languages }
    }
    if (!input.language) throw new Error(`${action} requires language`)
    if (action === 'remove') A.removeLanguage(input.language)
    else if (action === 'set_default') A.setDefaultLanguage(input.language)
    else if (action === 'switch') A.switchLanguage(input.language)
    else throw new Error(`Unknown action "${action}"`)
    const p = requireProject()
    return { success: true, languages: p.languages, defaultLanguage: p.defaultLanguage, current: getState().sel.language }
  },

  async set_copy({ entries }) {
    const resolved: A.CopyEntry[] = []
    const errors: string[] = []
    entries.forEach((e: Input, i: number) => {
      try {
        const field = String(e.field)
        if (!['headline', 'subheadline'].includes(field) && !field.startsWith('element:')) throw new Error(`field must be headline, subheadline or element:<id>`)
        resolved.push({ screenId: resolveScreenId(e), field: field as ops.StringField, language: e.language, text: e.text })
      } catch (err) {
        errors.push(`#${i}: ${(err as Error).message}`)
      }
    })
    const r = resolved.length ? A.setCopy(resolved) : { applied: 0, errors: [], addedLanguages: [] }
    return { applied: r.applied, total: entries.length, addedLanguages: r.addedLanguages, errors: [...errors, ...r.errors] }
  },

  async copy_strings({ fromDeckId, toDeckId, languages }) {
    const copied = A.copyStringsBetweenDecks(fromDeckId, toDeckId, languages)
    return { success: true, copied }
  },

  async set_background(input) {
    const ids = resolveTargets(input)
    const patch: Input = {}
    for (const k of ['type', 'solid', 'imageFit', 'imageBlur', 'overlayColor', 'overlayOpacity', 'noise', 'noiseIntensity']) if (input[k] !== undefined) patch[k] = input[k]
    if (input.gradientPreset) {
      const preset = GRADIENT_PRESETS.find(g => g.name === input.gradientPreset)!
      patch.gradient = { angle: preset.angle, stops: preset.stops }
      patch.type ??= 'gradient'
    }
    if (input.gradient) {
      patch.gradient = { ...(patch.gradient ?? {}), ...input.gradient }
      patch.type ??= 'gradient'
    }
    if (input.imageDataUrl) {
      const ref = await importDataUrl(input.imageDataUrl, 'background')
      patch.imageAssetId = ref.assetId
      patch.type ??= 'image'
    }
    A.setBackground(ids, patch)
    return { success: true, updated: ids.length, background: screenLoc(ids[0]).screen.background }
  },

  async set_device(input) {
    const ids = resolveTargets(input)
    const patch: Input = {}
    for (const k of ['scale', 'x', 'y', 'rotation', 'perspective', 'cornerRadius', 'chrome', 'use3D', 'model3D', 'modelColor', 'rotation3D', 'shadow', 'border']) if (input[k] !== undefined) patch[k] = input[k]
    if (patch.modelColor) {
      const model = (patch.model3D ?? screenLoc(ids[0]).screen.device.model3D) as 'iphone' | 'samsung'
      if (!MODEL_COLOR_PRESETS[model].some(p => p.id === patch.modelColor)) throw new Error(`modelColor for ${model} must be one of ${MODEL_COLOR_PRESETS[model].map(p => p.id).join(', ')}`)
    }
    if (patch.model3D && !patch.modelColor) {
      const current3D = screenLoc(ids[0]).screen.device
      if (!MODEL_COLOR_PRESETS[patch.model3D as 'iphone' | 'samsung'].some(p => p.id === current3D.modelColor)) patch.modelColor = MODEL_COLOR_PRESETS[patch.model3D as 'iphone' | 'samsung'][0].id
    }
    A.setDevice(ids, patch, input.preset as PositionPresetId | undefined)
    if (input.preset && POSITION_PRESETS[input.preset as PositionPresetId]?.text) {
      A.setTextStyle(ids, POSITION_PRESETS[input.preset as PositionPresetId].text!)
    }
    return { success: true, updated: ids.length, device: screenLoc(ids[0]).screen.device }
  },

  async set_text_style(input) {
    const ids = resolveTargets(input)
    const patch: Input = {}
    for (const k of ['headline', 'subheadline', 'position', 'align', 'offsetY', 'x', 'maxWidth', 'lineHeight', 'gap']) if (input[k] !== undefined) patch[k] = input[k]
    for (const k of ['headline', 'subheadline']) {
      const font = patch[k]?.font
      if (font && googleFamilyOf(font)) await loadGoogleFont(googleFamilyOf(font)!)
    }
    if (input.resetLanguageOverride) {
      if (!input.language) throw new Error('resetLanguageOverride requires language')
      A.clearLanguageOverride(ids, input.language)
    }
    if (Object.keys(patch).length) A.setTextStyle(ids, patch, input.language)
    const screen = screenLoc(ids[0]).screen
    return { success: true, updated: ids.length, text: screen.text }
  },

  async manage_elements(input) {
    const { action } = input
    const screenId = resolveScreenId(input)
    focusScreen(screenId)
    const props: Input = input.properties ?? {}
    if (props.font && googleFamilyOf(props.font)) await loadGoogleFont(googleFamilyOf(props.font)!)
    if (props.icon && !(await iconExists(props.icon))) throw new Error(`Unknown Lucide icon "${props.icon}"`)
    if (action === 'add') {
      const lang = normalizeLang(input.language ?? getState().sel.language)
      let el: CanvasElement
      const base = { id: newId('el'), x: 50, y: 50, rotation: 0, opacity: 100, layer: 'above-text' as const }
      if (input.kind === 'text' || (!input.kind && input.text)) {
        if (!input.text) throw new Error('text elements need text')
        el = newTextElement(input.text, lang)
      } else if (input.kind === 'emoji') {
        if (!input.emoji) throw new Error('emoji elements need emoji')
        el = { ...base, kind: 'emoji', name: 'Emoji', width: 12, emoji: input.emoji }
      } else if (input.kind === 'icon') {
        if (!input.icon) throw new Error('icon elements need icon (Lucide name)')
        if (!(await iconExists(input.icon))) throw new Error(`Unknown Lucide icon "${input.icon}"`)
        el = { ...base, kind: 'icon', name: input.icon, width: 12, icon: input.icon, color: '#ffffff', strokeWidth: 2, shadow: { enabled: false, color: '#000000', blur: 20, opacity: 40, x: 0, y: 10 } }
      } else if (input.kind === 'image') {
        if (!input.imageDataUrl) throw new Error('image elements need imageDataUrl')
        const ref = await importDataUrl(input.imageDataUrl, 'graphic')
        el = { ...base, kind: 'image', name: 'Image', width: 25, assetId: ref.assetId }
      } else throw new Error('add requires kind (text, emoji, icon, image)')
      const id = A.addElement(screenId, el)
      if (Object.keys(props).length) A.updateElement(screenId, id, filterElementProps(el, props))
      return { success: true, screenId, elementId: id }
    }
    if (!input.elementId) throw new Error(`${action} requires elementId`)
    const el = screenLoc(screenId).screen.elements.find(e => e.id === input.elementId)
    if (!el) throw new Error(`Element "${input.elementId}" is not on screen ${screenId}`)
    if (action === 'update') {
      if (input.text !== undefined) {
        if (el.kind !== 'text') throw new Error('text can only be set on text elements')
        A.setCopy([{ screenId, field: `element:${el.id}`, language: input.language ?? getState().sel.language, text: input.text }])
      }
      if (Object.keys(props).length) A.updateElement(screenId, el.id, filterElementProps(el, props))
      return { success: true, element: screenLoc(screenId).screen.elements.find(e => e.id === el.id) }
    }
    if (action === 'delete') {
      A.deleteElement(screenId, el.id)
      return { success: true }
    }
    if (action === 'reorder') {
      if (typeof input.toIndex !== 'number') throw new Error('reorder requires toIndex')
      A.reorderElement(screenId, el.id, input.toIndex)
      return { success: true, order: screenLoc(screenId).screen.elements.map(e => e.id) }
    }
    throw new Error(`Unknown action "${action}"`)
  },

  async manage_popouts(input) {
    const { action } = input
    const screenId = resolveScreenId(input)
    focusScreen(screenId)
    if (action === 'add') {
      const id = A.addPopout(screenId)
      if (input.properties) A.updatePopout(screenId, id, input.properties)
      return { success: true, popoutId: id }
    }
    if (!input.popoutId) throw new Error(`${action} requires popoutId`)
    if (action === 'update') {
      if (!input.properties) throw new Error('update requires properties')
      A.updatePopout(screenId, input.popoutId, input.properties)
      return { success: true, popout: screenLoc(screenId).screen.popouts.find(p => p.id === input.popoutId) }
    }
    if (action === 'delete') {
      A.deletePopout(screenId, input.popoutId)
      return { success: true }
    }
    throw new Error(`Unknown action "${action}"`)
  },

  async transfer_style(input) {
    const project = requireProject()
    const sourceId = resolveScreenId({ screenId: input.sourceScreenId, screenIndex: input.sourceScreenIndex, deckId: input.deckId })
    const src = screenLoc(sourceId)
    let targets: string[]
    if (input.targetScreenIds?.length) targets = input.targetScreenIds
    else if (input.targetScope === 'platform') targets = src.deck.screens.map(s => s.id)
    else if (input.targetScope === 'variant') targets = src.variant.decks.flatMap(d => d.screens.map(s => s.id))
    else if (input.targetScope === 'project') targets = project.variants.flatMap(v => v.decks.flatMap(d => d.screens.map(s => s.id)))
    else throw new Error('Provide targetScreenIds or targetScope')
    const n = A.transferStyle(sourceId, targets, input.parts ?? {})
    return { success: true, sourceScreenId: sourceId, updated: n }
  },

  async export(input, { signal }) {
    const project = requireProject()
    const sel = getState().sel
    const languages: string[] = input.allLanguages ? project.languages : input.languages?.length ? input.languages.map(normalizeLang) : [sel.language]
    for (const l of languages) if (!project.languages.includes(l)) throw new Error(`Language "${l}" is not in the project`)
    const variantIds: string[] | undefined = input.variantIds?.length ? input.variantIds : input.deckIds?.length || input.screenIds?.length ? undefined : [sel.variantId!]
    const deckIds: string[] | undefined = input.deckIds?.length ? input.deckIds : input.allPlatforms || input.screenIds?.length ? undefined : [sel.deckId!]
    const format = input.format ?? 'png'
    const scope = { variantIds, deckIds, screenIds: input.screenIds, languages, format }
    const plan = planExport(project, scope)
    if (!plan.length) throw new Error('Nothing to export for this selection')
    if ((input.delivery ?? 'return') === 'download') {
      const { blob, files } = await exportZip(project, scope, undefined, signal)
      const name = `${slug(project.name)}-screenshots.zip`
      downloadBlob(blob, name)
      return { success: true, delivery: 'download', filename: name, files, sizeKB: Math.round(blob.size / 1024), paths: plan.map(p => p.path) }
    }
    if (plan.length > 24) throw new Error(`${plan.length} files requested — max 24 per call with delivery "return". Narrow with deckIds/screenIds/languages, or use delivery "download".`)
    const files = []
    for (const item of plan) {
      checkAborted(signal)
      const r = await renderScreenImage(item.screen, item.deck, project, item.language, { signal })
      const blob = await canvasToBlob(r.canvas, format)
      const dataUrl = await new Promise<string>(res => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result))
        fr.readAsDataURL(blob)
      })
      files.push({ path: item.path, screenId: item.screenId, language: item.language, width: r.width, height: r.height, sizeKB: Math.round(blob.size / 1024), dataUrl })
    }
    return { success: true, delivery: 'return', count: files.length, files }
  },

  async history({ action, steps = 1 }) {
    const labels: string[] = []
    for (let i = 0; i < steps; i++) {
      const l = action === 'undo' ? undo() : redo()
      if (!l) break
      labels.push(l)
    }
    const s = getState()
    return { success: labels.length > 0, applied: labels, canUndo: s.past.length > 0, canRedo: s.future.length > 0 }
  },
}

const ELEMENT_KEYS: Record<CanvasElement['kind'], string[]> = {
  text: ['name', 'x', 'y', 'width', 'rotation', 'opacity', 'layer', 'font', 'fontSize', 'fontWeight', 'color', 'italic', 'frame', 'frameColor', 'frameScale'],
  emoji: ['name', 'x', 'y', 'width', 'rotation', 'opacity', 'layer', 'emoji'],
  icon: ['name', 'x', 'y', 'width', 'rotation', 'opacity', 'layer', 'icon', 'color', 'strokeWidth', 'shadow'],
  image: ['name', 'x', 'y', 'width', 'rotation', 'opacity', 'layer'],
}

function filterElementProps(el: CanvasElement, props: Input): Input {
  const allowed = ELEMENT_KEYS[el.kind]
  const bad = Object.keys(props).filter(k => !allowed.includes(k))
  if (bad.length) throw new Error(`${bad.join(', ')} not applicable to ${el.kind} elements (allowed: ${allowed.join(', ')})`)
  return props
}

// ---------------------------------------------------------------- assembly

export function buildTools(): ToolDefinition[] {
  return TOOL_SPECS.map(spec => {
    const run = impl[spec.name]
    if (!run) throw new Error(`Missing implementation for tool ${spec.name}`)
    return {
      ...spec,
      execute: async (raw: unknown, ctx: ToolContext = {}) => {
        const input = (raw ?? {}) as Input
        validate(spec.inputSchema, input)
        checkAborted(ctx.signal)
        await ensureEditor()
        setState({ agentActivity: spec.title })
        try {
          return await run(input, ctx)
        } finally {
          setState({ agentActivity: null })
        }
      },
    }
  })
}
