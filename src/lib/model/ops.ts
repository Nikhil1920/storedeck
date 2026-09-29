// Pure document operations shared by the editor UI and the WebMCP tools.
// Functions that mutate take an (immer) draft and never touch the DOM.

import { newDeck, newId, newScreen, defaultDevice, defaultText, POSITION_PRESETS, type PositionPresetId } from './defaults'
import { normalizeLang } from './languages'
import { getPlatform, resolveDeckSize } from './platforms'
import type {
  AssetRef,
  Background,
  CanvasElement,
  DeviceSettings,
  LangCode,
  Localized,
  PlatformDeck,
  Popout,
  Project,
  ProjectMeta,
  Screen,
  TextBlockStyle,
  TextLayoutOverride,
  TextSettings,
  Variant,
} from './types'

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] }

// ---------------------------------------------------------------- lookups

export interface ScreenLocation {
  variant: Variant
  deck: PlatformDeck
  screen: Screen
  index: number
}

export function findVariant(project: Project, variantId: string): Variant | undefined {
  return project.variants.find(v => v.id === variantId)
}

export function findDeck(project: Project, deckId: string): { variant: Variant; deck: PlatformDeck } | undefined {
  for (const variant of project.variants) {
    const deck = variant.decks.find(d => d.id === deckId)
    if (deck) return { variant, deck }
  }
  return undefined
}

export function findScreen(project: Project, screenId: string): ScreenLocation | undefined {
  for (const variant of project.variants) {
    for (const deck of variant.decks) {
      const index = deck.screens.findIndex(s => s.id === screenId)
      if (index !== -1) return { variant, deck, screen: deck.screens[index], index }
    }
  }
  return undefined
}

export function requireVariant(project: Project, variantId: string): Variant {
  const v = findVariant(project, variantId)
  if (!v) throw new Error(`Variant "${variantId}" not found. Variants: ${project.variants.map(x => `${x.id} (${x.name})`).join(', ')}`)
  return v
}

export function requireDeck(project: Project, deckId: string): { variant: Variant; deck: PlatformDeck } {
  const d = findDeck(project, deckId)
  if (!d) throw new Error(`Platform deck "${deckId}" not found`)
  return d
}

export function requireScreen(project: Project, screenId: string): ScreenLocation {
  const s = findScreen(project, screenId)
  if (!s) throw new Error(`Screen "${screenId}" not found`)
  return s
}

export function projectMeta(project: Project): ProjectMeta {
  let screenCount = 0
  for (const v of project.variants) for (const d of v.decks) screenCount += d.screens.length
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    variantCount: project.variants.length,
    screenCount,
  }
}

// ---------------------------------------------------------------- localization

/** Language fallback order: requested → project default → other project languages → anything. */
export function fallbackChain(project: Pick<Project, 'languages' | 'defaultLanguage'>, lang: LangCode): LangCode[] {
  const chain = [lang, project.defaultLanguage, ...project.languages]
  return [...new Set(chain)]
}

export function resolveLocalized<T>(map: Localized<T> | undefined, chain: LangCode[]): T | undefined {
  if (!map) return undefined
  for (const l of chain) {
    const v = map[l]
    if (v !== undefined && v !== null && (typeof v !== 'string' || v !== '')) return v
  }
  for (const v of Object.values(map)) {
    if (v !== undefined && v !== null && (typeof v !== 'string' || v !== '')) return v
  }
  return undefined
}

export function screenImage(screen: Screen, chain: LangCode[]): AssetRef | undefined {
  return resolveLocalized(screen.images, chain)
}

export function addLanguage(project: Project, lang: string): boolean {
  const code = normalizeLang(lang)
  if (project.languages.includes(code)) return false
  project.languages.push(code)
  return true
}

/** Removes a language from the active list. Existing copy is kept so re-adding restores it. */
export function removeLanguage(project: Project, lang: string): void {
  const code = normalizeLang(lang)
  if (!project.languages.includes(code)) return
  if (project.languages.length <= 1) throw new Error('A project needs at least one language')
  project.languages = project.languages.filter(l => l !== code)
  if (project.defaultLanguage === code) project.defaultLanguage = project.languages[0]
  if (project.lastSelection.language === code) project.lastSelection.language = project.defaultLanguage
}

// ---------------------------------------------------------------- strings

export type StringField = 'headline' | 'subheadline' | `element:${string}`

export interface StringRow {
  variantId: string
  deckId: string
  screenId: string
  screenIndex: number
  screenName: string
  field: StringField
  values: Localized<string>
}

export function collectStrings(project: Project, filter: { variantId?: string; deckId?: string } = {}): StringRow[] {
  const rows: StringRow[] = []
  for (const variant of project.variants) {
    if (filter.variantId && variant.id !== filter.variantId) continue
    for (const deck of variant.decks) {
      if (filter.deckId && deck.id !== filter.deckId) continue
      deck.screens.forEach((screen, screenIndex) => {
        const base = { variantId: variant.id, deckId: deck.id, screenId: screen.id, screenIndex, screenName: screen.name }
        rows.push({ ...base, field: 'headline', values: { ...screen.copy.headline } })
        rows.push({ ...base, field: 'subheadline', values: { ...screen.copy.subheadline } })
        for (const el of screen.elements) {
          if (el.kind === 'text') rows.push({ ...base, field: `element:${el.id}`, values: { ...el.texts } })
        }
      })
    }
  }
  return rows
}

export function missingTranslations(project: Project, rows: StringRow[]): Array<{ screenId: string; field: StringField; missing: LangCode[] }> {
  const out: Array<{ screenId: string; field: StringField; missing: LangCode[] }> = []
  for (const row of rows) {
    const hasAny = Object.values(row.values).some(v => v?.trim())
    if (!hasAny) continue
    const missing = project.languages.filter(l => !row.values[l]?.trim())
    if (missing.length) out.push({ screenId: row.screenId, field: row.field, missing })
  }
  return out
}

export function setString(screen: Screen, field: StringField, lang: string, text: string): void {
  const code = normalizeLang(lang)
  if (field === 'headline') {
    screen.copy.headline[code] = text
    if (text.trim()) screen.text.headline.enabled = true
  } else if (field === 'subheadline') {
    screen.copy.subheadline[code] = text
    if (text.trim()) screen.text.subheadline.enabled = true
  } else if (field.startsWith('element:')) {
    const id = field.slice('element:'.length)
    const el = screen.elements.find(e => e.id === id)
    if (!el || el.kind !== 'text') throw new Error(`Text element "${id}" not found on screen ${screen.id}`)
    el.texts[code] = text
  } else {
    throw new Error(`Unknown string field "${field}"`)
  }
}

/** Copies headline/subheadline copy between decks by screen position. */
export function copyStrings(from: PlatformDeck, to: PlatformDeck, langs?: LangCode[]): number {
  let copied = 0
  to.screens.forEach((target, i) => {
    const source = from.screens[i]
    if (!source) return
    for (const field of ['headline', 'subheadline'] as const) {
      for (const [lang, text] of Object.entries(source.copy[field])) {
        if (langs && !langs.includes(lang)) continue
        target.copy[field][lang] = text
        copied++
      }
      target.text[field].enabled = source.text[field].enabled
    }
  })
  return copied
}

// ---------------------------------------------------------------- cloning

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function cloneElement(el: CanvasElement): CanvasElement {
  return { ...cloneJson(el), id: newId('el') }
}

export function clonePopout(p: Popout): Popout {
  return { ...cloneJson(p), id: newId('pop') }
}

export function cloneScreen(screen: Screen, name?: string): Screen {
  const copy = cloneJson(screen)
  copy.id = newId('scr')
  if (name) copy.name = name
  copy.elements = screen.elements.map(cloneElement)
  copy.popouts = screen.popouts.map(clonePopout)
  return copy
}

export function cloneDeck(deck: PlatformDeck): PlatformDeck {
  return { ...cloneJson(deck), id: newId('dck'), screens: deck.screens.map(s => cloneScreen(s)) }
}

export function cloneVariant(variant: Variant, name: string): Variant {
  return {
    ...cloneJson(variant),
    id: newId('var'),
    name,
    status: 'draft',
    createdAt: Date.now(),
    decks: variant.decks.map(cloneDeck),
  }
}

export function cloneProject(project: Project, name: string): Project {
  const copy = cloneJson(project)
  copy.id = newId('prj')
  copy.name = name
  copy.variants = project.variants.map(v => ({ ...cloneVariant(v, v.name), status: v.status }))
  copy.createdAt = copy.updatedAt = Date.now()
  copy.lastSelection = { variantId: copy.variants[0]?.id ?? null, deckId: copy.variants[0]?.decks[0]?.id ?? null, screenId: null, language: copy.defaultLanguage }
  return copy
}

// ---------------------------------------------------------------- adapting between sizes

function headlineBase(w: number, h: number): number {
  return Math.min(w * 0.076, h * 0.07)
}

/**
 * Re-targets a screen designed for one output size to another: pixel-based
 * values (font sizes, shadows) scale with the canvas, and orientation changes
 * reset device placement to the target platform's defaults.
 */
export function adaptScreen(screen: Screen, from: { width: number; height: number }, to: { width: number; height: number }, targetPlatformId: string): void {
  const k = headlineBase(to.width, to.height) / headlineBase(from.width, from.height)
  const round = (n: number) => Math.round(n * 10) / 10
  if (Math.abs(k - 1) > 0.001) {
    screen.text.headline.size = round(screen.text.headline.size * k)
    screen.text.subheadline.size = round(screen.text.subheadline.size * k)
    for (const o of Object.values(screen.text.languageOverrides)) {
      if (o.headlineSize) o.headlineSize = round(o.headlineSize * k)
      if (o.subheadlineSize) o.subheadlineSize = round(o.subheadlineSize * k)
    }
    const sk = to.width / from.width
    for (const sh of [screen.device.shadow, ...screen.popouts.map(p => p.shadow)]) {
      sh.blur = round(sh.blur * sk)
      sh.x = round(sh.x * sk)
      sh.y = round(sh.y * sk)
    }
    for (const el of screen.elements) {
      if (el.kind === 'text') el.fontSize = round(el.fontSize * k)
    }
  }
  const fromLandscape = from.width > from.height
  const toLandscape = to.width > to.height
  const target = getPlatform(targetPlatformId)
  if (fromLandscape !== toLandscape) {
    const d = defaultDevice(targetPlatformId)
    Object.assign(screen.device, { scale: d.scale, x: d.x, y: d.y, rotation: 0, perspective: 0 })
    const t = defaultText(to.width, to.height)
    Object.assign(screen.text, { offsetY: t.offsetY, x: 50, align: 'center', maxWidth: t.maxWidth })
  }
  if (target) {
    // A portrait phone capture on a landscape canvas still reads as a phone.
    const img = Object.values(screen.images)[0]
    const portraitImage = img ? img.height > img.width * 1.2 : false
    const landscapeChrome = ['tv', 'laptop', 'monitor', 'window', 'browser'].includes(target.defaultChrome)
    screen.device.chrome.style = portraitImage && landscapeChrome ? (screen.device.chrome.style !== 'none' ? screen.device.chrome.style : 'phone') : target.defaultChrome
    if (screen.device.use3D && !target.models3D.includes(screen.device.model3D)) screen.device.use3D = false
  }
}

export function addDeck(variant: Variant, platformId: string, opts: { sizeId?: string; cloneFrom?: PlatformDeck } = {}): PlatformDeck {
  const deck = newDeck(platformId, opts.sizeId)
  if (opts.cloneFrom) {
    const from = resolveDeckSize(opts.cloneFrom)
    const to = resolveDeckSize(deck)
    deck.screens = opts.cloneFrom.screens.map(s => {
      const c = cloneScreen(s)
      adaptScreen(c, from, to, platformId)
      return c
    })
  }
  variant.decks.push(deck)
  return deck
}

/** Changes a deck's output size, rescaling pixel-based design values. */
export function setDeckSize(deck: PlatformDeck, patch: { sizeId?: string; customSize?: { width: number; height: number }; orientation?: 'portrait' | 'landscape' }): void {
  const before = resolveDeckSize(deck)
  if (patch.sizeId !== undefined) deck.sizeId = patch.sizeId
  if (patch.customSize) deck.customSize = { ...patch.customSize }
  if (patch.orientation) deck.orientation = patch.orientation
  const after = resolveDeckSize(deck)
  if (before.width === after.width && before.height === after.height) return
  for (const s of deck.screens) adaptScreen(s, before, after, deck.platformId)
}

// ---------------------------------------------------------------- style transfer

export interface TransferOptions {
  background?: boolean
  device?: boolean
  text?: boolean
  elements?: boolean
}

/** Copies design from source to target; copy (words) and images stay with the target. */
export function transferStyle(source: Screen, target: Screen, opts: TransferOptions = {}, sizes?: { from: { width: number; height: number }; to: { width: number; height: number }; platformId: string }): void {
  const o = { background: true, device: true, text: true, elements: true, ...opts }
  if (o.background) target.background = cloneJson(source.background)
  if (o.device) target.device = cloneJson(source.device)
  if (o.text) target.text = cloneJson(source.text)
  if (o.elements) target.elements = source.elements.map(cloneElement)
  if (sizes && (sizes.from.width !== sizes.to.width || sizes.from.height !== sizes.to.height)) {
    adaptScreen(target, sizes.from, sizes.to, sizes.platformId)
  }
}

// ---------------------------------------------------------------- patches

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Recursively assigns defined values; arrays and primitives replace. Unknown keys are rejected. */
export function deepAssign(target: Record<string, unknown>, patch: Record<string, unknown>, path = ''): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (!(key in target)) throw new Error(`Unknown property "${path}${key}"`)
    const current = target[key]
    if (isPlainObject(value) && isPlainObject(current)) {
      deepAssign(current, value, `${path}${key}.`)
    } else {
      target[key] = Array.isArray(value) ? cloneJson(value) : value
    }
  }
}

const HEX = /^#[0-9a-f]{6}$/i
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v)
}

export function assertHex(v: unknown, name: string): void {
  if (v !== undefined && !isHexColor(v)) throw new Error(`${name} must be a #rrggbb color, got ${JSON.stringify(v)}`)
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function applyBackgroundPatch(bg: Background, patch: DeepPartial<Background>): void {
  assertHex(patch.solid, 'solid')
  assertHex(patch.overlayColor, 'overlayColor')
  if (patch.gradient?.stops) {
    if (patch.gradient.stops.length < 2) throw new Error('A gradient needs at least 2 stops')
    patch.gradient.stops.forEach((s, i) => assertHex(s.color, `gradient.stops[${i}].color`))
    patch.gradient = { ...patch.gradient, stops: [...patch.gradient.stops].map(s => ({ color: s.color, position: clamp(Number(s.position), 0, 100) })).sort((a, b) => a.position - b.position) }
  }
  deepAssign(bg as unknown as Record<string, unknown>, patch as Record<string, unknown>)
  bg.imageBlur = clamp(bg.imageBlur, 0, 100)
  bg.overlayOpacity = clamp(bg.overlayOpacity, 0, 100)
  bg.noiseIntensity = clamp(bg.noiseIntensity, 0, 100)
  bg.gradient.angle = ((bg.gradient.angle % 360) + 360) % 360
}

export function applyDevicePatch(device: DeviceSettings, patch: DeepPartial<DeviceSettings>, preset?: PositionPresetId): void {
  if (preset) {
    const p = POSITION_PRESETS[preset]
    if (!p) throw new Error(`Unknown preset "${preset}". Presets: ${Object.keys(POSITION_PRESETS).join(', ')}`)
    Object.assign(device, p.device)
  }
  assertHex(patch.shadow?.color, 'shadow.color')
  assertHex(patch.border?.color, 'border.color')
  assertHex(patch.chrome?.color, 'chrome.color')
  deepAssign(device as unknown as Record<string, unknown>, patch as Record<string, unknown>)
  device.scale = clamp(device.scale, 10, 150)
  device.x = clamp(device.x, -100, 200)
  device.y = clamp(device.y, -100, 200)
  device.rotation = clamp(device.rotation, -180, 180)
  device.perspective = clamp(device.perspective, -50, 50)
  device.cornerRadius = clamp(device.cornerRadius, 0, 200)
  for (const axis of ['x', 'y', 'z'] as const) device.rotation3D[axis] = clamp(device.rotation3D[axis], -60, 60)
  device.shadow.opacity = clamp(device.shadow.opacity, 0, 100)
  device.shadow.blur = clamp(device.shadow.blur, 0, 400)
  device.border.opacity = clamp(device.border.opacity, 0, 100)
  device.border.width = clamp(device.border.width, 0, 100)
}

export type TextPatch = DeepPartial<Omit<TextSettings, 'languageOverrides'>>

export function applyTextPatch(text: TextSettings, patch: TextPatch, language?: string): void {
  for (const key of ['headline', 'subheadline'] as const) assertHex(patch[key]?.color, `${key}.color`)
  if (patch.position !== undefined && !['top', 'bottom'].includes(patch.position)) throw new Error('position must be "top" or "bottom"')
  if (patch.align !== undefined && !['left', 'center', 'right'].includes(patch.align)) throw new Error('align must be left, center or right')
  if (language) {
    // Per-language overrides only cover sizes and vertical rhythm.
    const code = normalizeLang(language)
    const o: TextLayoutOverride = { ...(text.languageOverrides[code] ?? {}) }
    if (patch.headline?.size !== undefined) o.headlineSize = patch.headline.size
    if (patch.subheadline?.size !== undefined) o.subheadlineSize = patch.subheadline.size
    if (patch.offsetY !== undefined) o.offsetY = patch.offsetY
    if (patch.lineHeight !== undefined) o.lineHeight = patch.lineHeight
    text.languageOverrides[code] = o
    const rest: TextPatch = { ...patch, offsetY: undefined, lineHeight: undefined }
    if (rest.headline) rest.headline = { ...rest.headline, size: undefined }
    if (rest.subheadline) rest.subheadline = { ...rest.subheadline, size: undefined }
    deepAssign(text as unknown as Record<string, unknown>, rest as Record<string, unknown>)
  } else {
    deepAssign(text as unknown as Record<string, unknown>, patch as Record<string, unknown>)
  }
  for (const b of [text.headline, text.subheadline] as TextBlockStyle[]) {
    b.size = clamp(b.size, 4, 1000)
    b.opacity = clamp(b.opacity, 0, 100)
  }
  text.maxWidth = clamp(text.maxWidth, 10, 100)
  text.lineHeight = clamp(text.lineHeight, 50, 300)
}

export function effectiveLayout(text: TextSettings, lang: string) {
  const o = text.languageOverrides[lang] ?? {}
  return {
    headlineSize: o.headlineSize ?? text.headline.size,
    subheadlineSize: o.subheadlineSize ?? text.subheadline.size,
    offsetY: o.offsetY ?? text.offsetY,
    lineHeight: o.lineHeight ?? text.lineHeight,
  }
}

export function moveInArray<T>(arr: T[], from: number, to: number): void {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) throw new Error(`Invalid move ${from} → ${to} (0-${arr.length - 1})`)
  const [item] = arr.splice(from, 1)
  arr.splice(to, 0, item)
}

export function screenForDeck(deck: PlatformDeck, name: string, styleFrom?: Screen): Screen {
  const screen = newScreen(name, deck)
  if (styleFrom) transferStyle(styleFrom, screen)
  return screen
}

/** All asset ids referenced by a project (for garbage collection and export). */
export function referencedAssets(project: Project): Set<string> {
  const ids = new Set<string>()
  for (const v of project.variants)
    for (const d of v.decks)
      for (const s of d.screens) {
        for (const img of Object.values(s.images)) if (img?.assetId) ids.add(img.assetId)
        if (s.background.imageAssetId) ids.add(s.background.imageAssetId)
        for (const el of s.elements) if (el.kind === 'image') ids.add(el.assetId)
      }
  return ids
}
