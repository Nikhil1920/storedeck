import { getPlatform, requirePlatform, resolveDeckSize } from './platforms'
import type {
  Background,
  CanvasElement,
  DeviceSettings,
  GradientStop,
  PlatformDeck,
  Popout,
  Project,
  Screen,
  ShadowSettings,
  TextBlockStyle,
  TextSettings,
  Variant,
} from './types'
import { SCHEMA_VERSION } from './types'

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Short random ids keep tool payloads compact for agents. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ID_ALPHABET[b % 36]
  return `${prefix}_${out}`
}

export const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"

export const GRADIENT_PRESETS: Array<{ name: string; angle: number; stops: GradientStop[] }> = [
  { name: 'Indigo Rush', angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }] },
  { name: 'Midnight Abyss', angle: 160, stops: [{ color: '#0a0a0f', position: 0 }, { color: '#1a1033', position: 50 }, { color: '#0d1b2a', position: 100 }] },
  { name: 'Obsidian Plum', angle: 135, stops: [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 50 }, { color: '#24243e', position: 100 }] },
  { name: 'Carbon Slate', angle: 180, stops: [{ color: '#1c1c1e', position: 0 }, { color: '#2c2c2e', position: 100 }] },
  { name: 'Steel Blue', angle: 135, stops: [{ color: '#29323c', position: 0 }, { color: '#485563', position: 100 }] },
  { name: 'Neon Horizon', angle: 125, stops: [{ color: '#0d0221', position: 0 }, { color: '#711c91', position: 50 }, { color: '#0abdc6', position: 100 }] },
  { name: 'Electric Surge', angle: 135, stops: [{ color: '#1a0533', position: 0 }, { color: '#5b21b6', position: 50 }, { color: '#06b6d4', position: 100 }] },
  { name: 'Synthwave Dusk', angle: 150, stops: [{ color: '#2d1b69', position: 0 }, { color: '#ff2d78', position: 50 }, { color: '#ff901f', position: 100 }] },
  { name: 'Northern Lights', angle: 135, stops: [{ color: '#172347', position: 0 }, { color: '#015268', position: 40 }, { color: '#0ef3c5', position: 100 }] },
  { name: 'Deep Forest', angle: 160, stops: [{ color: '#0f2027', position: 0 }, { color: '#203a43', position: 50 }, { color: '#2c5364', position: 100 }] },
  { name: 'Emerald Canopy', angle: 145, stops: [{ color: '#134e4a', position: 0 }, { color: '#065f46', position: 50 }, { color: '#14532d', position: 100 }] },
  { name: 'Ocean Pulse', angle: 135, stops: [{ color: '#4facfe', position: 0 }, { color: '#00f2fe', position: 100 }] },
  { name: 'Desert Dusk', angle: 170, stops: [{ color: '#c84c28', position: 0 }, { color: '#d89c60', position: 50 }, { color: '#bb8a36', position: 100 }] },
  { name: 'Ember Glow', angle: 140, stops: [{ color: '#7c2d12', position: 0 }, { color: '#c2410c', position: 50 }, { color: '#fb923c', position: 100 }] },
  { name: 'Mocha Silk', angle: 160, stops: [{ color: '#292018', position: 0 }, { color: '#6b4226', position: 60 }, { color: '#a07850', position: 100 }] },
  { name: 'Golden Hour', angle: 135, stops: [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 100 }] },
  { name: 'Pacific Sunset', angle: 145, stops: [{ color: '#f953c6', position: 0 }, { color: '#b91d73', position: 50 }, { color: '#4a1942', position: 100 }] },
  { name: 'Volcanic Dawn', angle: 130, stops: [{ color: '#f12711', position: 0 }, { color: '#f5af19', position: 100 }] },
  { name: 'Deep Ocean', angle: 180, stops: [{ color: '#011627', position: 0 }, { color: '#003459', position: 50 }, { color: '#007ea7', position: 100 }] },
  { name: 'Reef Lagoon', angle: 135, stops: [{ color: '#1a6b7c', position: 0 }, { color: '#40b3c8', position: 50 }, { color: '#7de8dc', position: 100 }] },
  { name: 'Gold Noir', angle: 135, stops: [{ color: '#020b13', position: 0 }, { color: '#1a1200', position: 50 }, { color: '#c9a227', position: 100 }] },
  { name: 'Velvet Noir', angle: 150, stops: [{ color: '#1a0000', position: 0 }, { color: '#400128', position: 50 }, { color: '#6b0f1a', position: 100 }] },
  { name: 'Morning Mist', angle: 135, stops: [{ color: '#e0eafc', position: 0 }, { color: '#cfdef3', position: 100 }] },
  { name: 'Sage Whisper', angle: 135, stops: [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 100 }] },
  { name: 'Royal Navy', angle: 135, stops: [{ color: '#1e3c72', position: 0 }, { color: '#2a5298', position: 100 }] },
  { name: 'Paper White', angle: 180, stops: [{ color: '#fafaf9', position: 0 }, { color: '#e7e5e4', position: 100 }] },
]

export type PositionPresetId =
  | 'centered'
  | 'bleed-bottom'
  | 'bleed-top'
  | 'float-center'
  | 'tilt-left'
  | 'tilt-right'
  | 'perspective'
  | 'float-bottom'
  | 'side-right'
  | 'side-left'

export const POSITION_PRESETS: Record<PositionPresetId, { label: string; device: Pick<DeviceSettings, 'scale' | 'x' | 'y' | 'rotation' | 'perspective'>; text?: Partial<Pick<TextSettings, 'align' | 'x' | 'maxWidth' | 'position' | 'offsetY'>> }> = {
  centered: { label: 'Centered', device: { scale: 70, x: 50, y: 60, rotation: 0, perspective: 0 }, text: { align: 'center', x: 50, maxWidth: 84 } },
  'bleed-bottom': { label: 'Bleed bottom', device: { scale: 85, x: 50, y: 120, rotation: 0, perspective: 0 }, text: { align: 'center', x: 50, maxWidth: 84 } },
  'bleed-top': { label: 'Bleed top', device: { scale: 85, x: 50, y: -20, rotation: 0, perspective: 0 }, text: { position: 'bottom', align: 'center', x: 50, maxWidth: 84 } },
  'float-center': { label: 'Float center', device: { scale: 60, x: 50, y: 50, rotation: 0, perspective: 0 } },
  'tilt-left': { label: 'Tilt left', device: { scale: 65, x: 50, y: 60, rotation: -8, perspective: 0 } },
  'tilt-right': { label: 'Tilt right', device: { scale: 65, x: 50, y: 60, rotation: 8, perspective: 0 } },
  perspective: { label: 'Perspective', device: { scale: 65, x: 50, y: 50, rotation: 0, perspective: 15 } },
  'float-bottom': { label: 'Float bottom', device: { scale: 55, x: 50, y: 70, rotation: 0, perspective: 0 } },
  'side-right': { label: 'Text left, device right', device: { scale: 55, x: 78, y: 55, rotation: 0, perspective: 0 }, text: { align: 'left', x: 26, maxWidth: 40, position: 'top', offsetY: 30 } },
  'side-left': { label: 'Device left, text right', device: { scale: 55, x: 22, y: 55, rotation: 0, perspective: 0 }, text: { align: 'left', x: 74, maxWidth: 40, position: 'top', offsetY: 30 } },
}

export const FONT_WEIGHTS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Heavy' },
  { value: '900', label: 'Black' },
]

export function defaultShadow(): ShadowSettings {
  return { enabled: true, color: '#000000', blur: 40, opacity: 30, x: 0, y: 20 }
}

export function defaultBackground(): Background {
  return {
    type: 'gradient',
    gradient: { kind: 'linear', angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }] },
    solid: '#1a1a2e',
    imageAssetId: null,
    imageFit: 'cover',
    imageBlur: 0,
    overlayColor: '#000000',
    overlayOpacity: 0,
    noise: false,
    noiseIntensity: 10,
  }
}

export function defaultDevice(platformId?: string): DeviceSettings {
  const platform = platformId ? getPlatform(platformId) : undefined
  const landscape = platform?.orientation === 'landscape'
  return {
    scale: landscape ? 62 : 70,
    x: 50,
    y: landscape ? 64 : 65,
    rotation: 0,
    perspective: 0,
    cornerRadius: platform?.defaultChrome === 'phone' || !platform ? 24 : 12,
    chrome: { style: platform?.defaultChrome ?? 'none', color: '#1d1d1f' },
    use3D: false,
    model3D: platform?.models3D[0] ?? 'iphone',
    modelColor: platform?.models3D[0] === 'samsung' ? 'gray' : 'natural',
    rotation3D: { x: 0, y: 0, z: 0 },
    shadow: defaultShadow(),
    border: { enabled: false, color: '#ffffff', width: 12, opacity: 100 },
  }
}

function textBlock(size: number, weight: string, overrides: Partial<TextBlockStyle> = {}): TextBlockStyle {
  return {
    enabled: true,
    font: SYSTEM_FONT,
    size,
    weight,
    color: '#ffffff',
    opacity: 100,
    italic: false,
    underline: false,
    strikethrough: false,
    uppercase: false,
    letterSpacing: 0,
    ...overrides,
  }
}

/** Headline sizes scale with the output so a TV and a phone deck both start readable. */
export function defaultText(width = 1320, height = 2868): TextSettings {
  const headline = Math.round(Math.min(width * 0.076, height * 0.07))
  return {
    headline: textBlock(headline, '700'),
    subheadline: textBlock(Math.round(headline * 0.5), '400', { opacity: 75 }),
    position: 'top',
    align: 'center',
    offsetY: height > width ? 7 : 8,
    x: 50,
    maxWidth: 84,
    lineHeight: 110,
    gap: 30,
    languageOverrides: {},
  }
}

export function newScreen(name: string, deck?: Pick<PlatformDeck, 'platformId' | 'sizeId' | 'customSize' | 'orientation'>): Screen {
  const dims = deck ? resolveDeckSize(deck) : { width: 1320, height: 2868 }
  return {
    id: newId('scr'),
    name,
    images: {},
    background: defaultBackground(),
    device: defaultDevice(deck?.platformId),
    text: defaultText(dims.width, dims.height),
    copy: { headline: {}, subheadline: {} },
    elements: [],
    popouts: [],
  }
}

export function newDeck(platformId: string, sizeId?: string): PlatformDeck {
  const platform = requirePlatform(platformId)
  const resolvedSize = sizeId && (sizeId === 'custom' || platform.sizes.some(s => s.id === sizeId)) ? sizeId : platform.defaultSizeId
  const natural = platform.sizes.find(s => s.id === resolvedSize) ?? platform.sizes[0]
  return {
    id: newId('dck'),
    platformId,
    sizeId: resolvedSize,
    customSize: { width: natural.width, height: natural.height },
    orientation: natural.width > natural.height ? 'landscape' : 'portrait',
    screens: [],
  }
}

export function newVariant(name: string, platformIds: string[] = ['app-store-iphone']): Variant {
  return {
    id: newId('var'),
    name,
    status: 'draft',
    hypothesis: '',
    decks: platformIds.map(id => newDeck(id)),
    createdAt: Date.now(),
  }
}

export function newProject(name: string, opts: { platformIds?: string[]; languages?: string[]; appName?: string } = {}): Project {
  const variant = newVariant('Original', opts.platformIds?.length ? opts.platformIds : ['app-store-iphone'])
  variant.status = 'control'
  const languages = opts.languages?.length ? opts.languages : ['en']
  const now = Date.now()
  return {
    id: newId('prj'),
    schemaVersion: SCHEMA_VERSION,
    name,
    appName: opts.appName ?? name,
    languages,
    defaultLanguage: languages[0],
    variants: [variant],
    lastSelection: { variantId: variant.id, deckId: variant.decks[0]?.id ?? null, screenId: null, language: languages[0] },
    createdAt: now,
    updatedAt: now,
  }
}

export function newTextElement(text: string, lang: string): CanvasElement {
  return {
    id: newId('el'),
    kind: 'text',
    name: 'Text',
    x: 50,
    y: 50,
    width: 40,
    rotation: 0,
    opacity: 100,
    layer: 'above-text',
    texts: { [lang]: text },
    font: SYSTEM_FONT,
    fontSize: 60,
    fontWeight: '600',
    color: '#ffffff',
    italic: false,
    frame: 'none',
    frameColor: '#ffffff',
    frameScale: 100,
  }
}

export function newPopout(): Popout {
  return {
    id: newId('pop'),
    cropX: 25,
    cropY: 25,
    cropWidth: 30,
    cropHeight: 30,
    x: 70,
    y: 30,
    width: 30,
    rotation: 0,
    opacity: 100,
    cornerRadius: 12,
    shadow: { enabled: true, color: '#000000', blur: 30, opacity: 40, x: 0, y: 15 },
    border: { enabled: true, color: '#ffffff', width: 3, opacity: 100 },
  }
}
