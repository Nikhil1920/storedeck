// Converts projects from Storedeck v1 (vanilla app, IndexedDB database
// "AppStoreScreenshotGenerator") into the v3 document model.

import { defaultBackground, defaultDevice, defaultText, newDeck, newId, newProject, SYSTEM_FONT } from './defaults'
import { normalizeLang } from './languages'
import { LEGACY_OUTPUT_MAP, resolveDeckSize } from './platforms'
import type { AssetRef, CanvasElement, Localized, Popout, Project, Screen, TextFrame } from './types'

// Loose shape of the v1 records — everything optional because old saves vary.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

export type PutDataUrl = (dataUrl: string, name: string) => Promise<AssetRef>

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

function convertLocalizedText(map: Any): Localized<string> {
  const out: Localized<string> = {}
  if (map && typeof map === 'object') {
    for (const [k, v] of Object.entries(map)) if (typeof v === 'string') out[normalizeLang(k)] = v
  }
  return out
}

function convertElement(el: Any, lang: string, put: PutDataUrl): Promise<CanvasElement | null> | CanvasElement | null {
  const base = {
    id: newId('el'),
    name: str(el.name, 'Element'),
    x: num(el.x, 50),
    y: num(el.y, 50),
    width: num(el.width, 20),
    rotation: num(el.rotation, 0),
    opacity: num(el.opacity, 100),
    layer: el.layer === 'behind-screenshot' ? 'behind-device' as const : el.layer === 'above-screenshot' ? 'above-device' as const : 'above-text' as const,
  }
  if (el.type === 'text') {
    const texts = el.texts ? convertLocalizedText(el.texts) : { [lang]: str(el.text, '') }
    return {
      ...base,
      kind: 'text',
      texts,
      font: str(el.font, SYSTEM_FONT),
      fontSize: num(el.fontSize, 60),
      fontWeight: String(el.fontWeight ?? '600'),
      color: str(el.fontColor, '#ffffff'),
      italic: bool(el.italic, false),
      frame: (str(el.frame, 'none') as TextFrame),
      frameColor: str(el.frameColor, '#ffffff'),
      frameScale: num(el.frameScale, 100),
    }
  }
  if (el.type === 'emoji' && el.emoji) return { ...base, kind: 'emoji', emoji: el.emoji }
  if (el.type === 'icon' && el.iconName) {
    return {
      ...base,
      kind: 'icon',
      icon: el.iconName,
      color: str(el.iconColor, '#ffffff'),
      strokeWidth: num(el.iconStrokeWidth, 2),
      shadow: { enabled: bool(el.iconShadow?.enabled, false), color: str(el.iconShadow?.color, '#000000'), blur: num(el.iconShadow?.blur, 20), opacity: num(el.iconShadow?.opacity, 40), x: num(el.iconShadow?.x, 0), y: num(el.iconShadow?.y, 10) },
    }
  }
  if (el.type === 'graphic' && typeof el.src === 'string' && el.src.startsWith('data:image/')) {
    return put(el.src, str(el.name, 'graphic.png')).then(ref => ({ ...base, kind: 'image' as const, assetId: ref.assetId }))
  }
  return null
}

async function convertScreen(s: Any, deck: ReturnType<typeof newDeck>, put: PutDataUrl, fallbackLang: string): Promise<Screen> {
  const dims = resolveDeckSize(deck)
  const images: Localized<AssetRef> = {}
  if (s.localizedImages && typeof s.localizedImages === 'object') {
    for (const [lang, data] of Object.entries<Any>(s.localizedImages)) {
      if (typeof data?.src === 'string' && data.src.startsWith('data:image/')) {
        images[normalizeLang(lang)] = await put(data.src, str(data.name, s.name ?? 'screenshot.png'))
      }
    }
  }
  if (!Object.keys(images).length && typeof s.src === 'string' && s.src.startsWith('data:image/')) {
    images[fallbackLang] = await put(s.src, str(s.name, 'screenshot.png'))
  }

  const bg = defaultBackground()
  const lb = s.background ?? {}
  bg.type = lb.type === 'solid' || lb.type === 'gradient' ? lb.type : 'gradient'
  if (lb.gradient?.stops?.length >= 2) {
    // v1 measured angles from the x-axis; v3 uses CSS angles (0deg = to top).
    bg.gradient = { kind: 'linear', angle: (num(lb.gradient.angle, 45) + 90) % 360, stops: lb.gradient.stops.map((x: Any) => ({ color: str(x.color, '#000000'), position: num(x.position, 0) })) }
  }
  bg.solid = str(lb.solid, bg.solid)
  bg.overlayColor = str(lb.overlayColor, bg.overlayColor)
  bg.overlayOpacity = num(lb.overlayOpacity, 0)
  bg.noise = bool(lb.noise, false)
  bg.noiseIntensity = num(lb.noiseIntensity, 10)

  const device = defaultDevice(deck.platformId)
  const ls = s.screenshot ?? {}
  Object.assign(device, {
    scale: num(ls.scale, device.scale),
    x: num(ls.x, device.x),
    y: num(ls.y, device.y),
    rotation: num(ls.rotation, 0),
    perspective: num(ls.perspective, 0),
    cornerRadius: num(ls.cornerRadius, device.cornerRadius),
    use3D: bool(ls.use3D, false),
    model3D: ls.device3D === 'samsung' ? 'samsung' : 'iphone',
    modelColor: str(ls.frameColor, device.modelColor),
    rotation3D: { x: num(ls.rotation3D?.x, 0), y: num(ls.rotation3D?.y, 0), z: num(ls.rotation3D?.z, 0) },
  })
  device.chrome.style = 'none' // v1 had no 2D device chrome
  if (ls.shadow) Object.assign(device.shadow, { enabled: bool(ls.shadow.enabled, true), color: str(ls.shadow.color, '#000000'), blur: num(ls.shadow.blur, 40), opacity: num(ls.shadow.opacity, 30), x: num(ls.shadow.x, 0), y: num(ls.shadow.y, 20) })
  if (ls.frame) Object.assign(device.border, { enabled: bool(ls.frame.enabled, false), color: str(ls.frame.color, '#1d1d1f'), width: num(ls.frame.width, 12), opacity: num(ls.frame.opacity, 100) })

  const text = defaultText(dims.width, dims.height)
  const lt = s.text ?? {}
  Object.assign(text.headline, {
    enabled: lt.headlineEnabled !== false,
    font: str(lt.headlineFont, SYSTEM_FONT),
    size: num(lt.headlineSize, text.headline.size),
    weight: String(lt.headlineWeight ?? '600'),
    color: str(lt.headlineColor, '#ffffff'),
    italic: bool(lt.headlineItalic, false),
    underline: bool(lt.headlineUnderline, false),
    strikethrough: bool(lt.headlineStrikethrough, false),
  })
  Object.assign(text.subheadline, {
    enabled: bool(lt.subheadlineEnabled, false),
    font: str(lt.subheadlineFont, str(lt.headlineFont, SYSTEM_FONT)),
    size: num(lt.subheadlineSize, text.subheadline.size),
    weight: String(lt.subheadlineWeight ?? '400'),
    color: str(lt.subheadlineColor, '#ffffff'),
    opacity: num(lt.subheadlineOpacity, 70),
    italic: bool(lt.subheadlineItalic, false),
    underline: bool(lt.subheadlineUnderline, false),
    strikethrough: bool(lt.subheadlineStrikethrough, false),
  })
  text.position = lt.position === 'bottom' ? 'bottom' : 'top'
  text.offsetY = num(lt.offsetY, text.offsetY)
  text.lineHeight = num(lt.lineHeight, 110)
  text.gap = Math.max(0, text.lineHeight - 100)
  if (lt.perLanguageLayout && lt.languageSettings) {
    for (const [lang, o] of Object.entries<Any>(lt.languageSettings)) {
      text.languageOverrides[normalizeLang(lang)] = { headlineSize: num(o.headlineSize, text.headline.size), subheadlineSize: num(o.subheadlineSize, text.subheadline.size), offsetY: num(o.offsetY, text.offsetY), lineHeight: num(o.lineHeight, text.lineHeight) }
    }
  }

  const elements: CanvasElement[] = []
  for (const el of Array.isArray(s.elements) ? s.elements : []) {
    const converted = await convertElement(el, fallbackLang, put)
    if (converted) elements.push(converted)
  }

  const popouts: Popout[] = (Array.isArray(s.popouts) ? s.popouts : []).map((p: Any) => ({
    id: newId('pop'),
    cropX: num(p.cropX, 25), cropY: num(p.cropY, 25), cropWidth: num(p.cropWidth, 30), cropHeight: num(p.cropHeight, 30),
    x: num(p.x, 70), y: num(p.y, 30), width: num(p.width, 30), rotation: num(p.rotation, 0), opacity: num(p.opacity, 100), cornerRadius: num(p.cornerRadius, 12),
    shadow: { enabled: bool(p.shadow?.enabled, true), color: str(p.shadow?.color, '#000000'), blur: num(p.shadow?.blur, 30), opacity: num(p.shadow?.opacity, 40), x: num(p.shadow?.x, 0), y: num(p.shadow?.y, 15) },
    border: { enabled: bool(p.border?.enabled, true), color: str(p.border?.color, '#ffffff'), width: num(p.border?.width, 3), opacity: num(p.border?.opacity, 100) },
  }))

  return {
    id: newId('scr'),
    name: str(s.name, 'Screenshot').replace(/\.[^.]+$/, ''),
    images,
    background: bg,
    device,
    text,
    copy: { headline: convertLocalizedText(lt.headlines), subheadline: convertLocalizedText(lt.subheadlines) },
    elements,
    popouts,
  }
}

/** Converts one v1 project record. Images are handed to `put` for storage. */
export async function convertLegacyProject(record: Any, name: string, put: PutDataUrl): Promise<Project> {
  const languages: string[] = Array.isArray(record?.projectLanguages) && record.projectLanguages.length
    ? record.projectLanguages.map((l: string) => normalizeLang(l))
    : ['en']
  const mapping = LEGACY_OUTPUT_MAP[record?.outputDevice] ?? (record?.outputDevice === 'custom' ? { platformId: 'app-store-iphone', sizeId: 'custom' } : LEGACY_OUTPUT_MAP['iphone-6.9'])
  const project = newProject(name, { platformIds: [mapping.platformId], languages })
  const deck = project.variants[0].decks[0]
  deck.sizeId = mapping.sizeId
  if (mapping.sizeId === 'custom') deck.customSize = { width: num(record.customWidth, 1290), height: num(record.customHeight, 2796) }
  const dims = resolveDeckSize(deck)
  deck.orientation = dims.width > dims.height ? 'landscape' : 'portrait'
  for (const s of Array.isArray(record?.screenshots) ? record.screenshots : []) {
    deck.screens.push(await convertScreen(s, deck, put, languages[0]))
  }
  project.lastSelection = {
    variantId: project.variants[0].id,
    deckId: deck.id,
    screenId: deck.screens[num(record?.selectedIndex, 0)]?.id ?? deck.screens[0]?.id ?? null,
    language: languages.includes(record?.currentLanguage) ? record.currentLanguage : languages[0],
  }
  return project
}
