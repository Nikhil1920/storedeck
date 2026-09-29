// Storedeck document model.
//
// Hierarchy: Project → Variant (A/B test arm) → PlatformDeck (store + device
// class + output size) → Screen. Copy is stored per language on each screen,
// so every level can be localized independently. Images are referenced by
// content-addressed asset ids and stored separately (see lib/storage).

export type LangCode = string
export type Orientation = 'portrait' | 'landscape'
export type Localized<T> = Record<LangCode, T>

export const SCHEMA_VERSION = 3

export interface GradientStop {
  color: string
  position: number
}

export type BackgroundType = 'gradient' | 'solid' | 'image'
export type GradientKind = 'linear' | 'radial'
export type ImageFit = 'cover' | 'contain' | 'stretch'

export interface Background {
  type: BackgroundType
  gradient: { kind: GradientKind; angle: number; stops: GradientStop[] }
  solid: string
  imageAssetId: string | null
  imageFit: ImageFit
  imageBlur: number
  overlayColor: string
  overlayOpacity: number
  noise: boolean
  noiseIntensity: number
}

/** 2D device chrome drawn around the screenshot. */
export type ChromeStyle = 'none' | 'phone' | 'tablet' | 'laptop' | 'monitor' | 'browser' | 'window' | 'tv' | 'watch'
export type Model3D = 'iphone' | 'samsung'

export interface ShadowSettings {
  enabled: boolean
  color: string
  blur: number
  opacity: number
  x: number
  y: number
}

export interface DeviceSettings {
  /** Screenshot width as % of the canvas (height-limited). */
  scale: number
  /** Horizontal position, 50 = centered. Values outside 0-100 bleed off-canvas. */
  x: number
  /** Vertical position, 50 = centered. */
  y: number
  rotation: number
  perspective: number
  cornerRadius: number
  chrome: { style: ChromeStyle; color: string }
  use3D: boolean
  model3D: Model3D
  /** 3D frame color preset id (see render/three-presets). */
  modelColor: string
  rotation3D: { x: number; y: number; z: number }
  shadow: ShadowSettings
  border: { enabled: boolean; color: string; width: number; opacity: number }
}

export type TextPosition = 'top' | 'bottom'
export type TextAlign = 'left' | 'center' | 'right'

export interface TextBlockStyle {
  enabled: boolean
  font: string
  /** Font size in output pixels. */
  size: number
  weight: string
  color: string
  opacity: number
  italic: boolean
  underline: boolean
  strikethrough: boolean
  uppercase: boolean
  /** Letter spacing in em/100 (e.g. 2 = 0.02em). */
  letterSpacing: number
}

export interface TextLayoutOverride {
  headlineSize?: number
  subheadlineSize?: number
  offsetY?: number
  lineHeight?: number
}

export interface TextSettings {
  headline: TextBlockStyle
  subheadline: TextBlockStyle
  position: TextPosition
  align: TextAlign
  /** Distance from the top/bottom edge as % of canvas height. */
  offsetY: number
  /** Horizontal center of the text block as % of canvas width. */
  x: number
  /** Max text block width as % of canvas width. */
  maxWidth: number
  /** Headline line height in %. */
  lineHeight: number
  /** Extra gap between headline and subheadline in % of headline size. */
  gap: number
  /** Per-language layout tweaks for languages with longer/shorter copy. */
  languageOverrides: Localized<TextLayoutOverride>
}

export interface ScreenCopy {
  headline: Localized<string>
  subheadline: Localized<string>
}

export type ElementLayer = 'behind-device' | 'above-device' | 'above-text'
export type TextFrame =
  | 'none'
  | 'pill'
  | 'outline-pill'
  | 'laurel-simple'
  | 'laurel-simple-star'
  | 'laurel-detailed'
  | 'laurel-detailed-star'
  | 'badge-circle'
  | 'badge-ribbon'

interface ElementBase {
  id: string
  name: string
  /** Center position in % of canvas. */
  x: number
  y: number
  /** Width in % of canvas width. */
  width: number
  rotation: number
  opacity: number
  layer: ElementLayer
}

export interface TextElement extends ElementBase {
  kind: 'text'
  texts: Localized<string>
  font: string
  fontSize: number
  fontWeight: string
  color: string
  italic: boolean
  frame: TextFrame
  frameColor: string
  frameScale: number
}

export interface EmojiElement extends ElementBase {
  kind: 'emoji'
  emoji: string
}

export interface IconElement extends ElementBase {
  kind: 'icon'
  icon: string
  color: string
  strokeWidth: number
  shadow: ShadowSettings
}

export interface ImageElement extends ElementBase {
  kind: 'image'
  assetId: string
}

export type CanvasElement = TextElement | EmojiElement | IconElement | ImageElement
export type ElementKind = CanvasElement['kind']

export interface Popout {
  id: string
  /** Crop region of the source screenshot in %. */
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  x: number
  y: number
  width: number
  rotation: number
  opacity: number
  cornerRadius: number
  shadow: ShadowSettings
  border: { enabled: boolean; color: string; width: number; opacity: number }
}

export interface AssetRef {
  assetId: string
  name: string
  width: number
  height: number
}

export interface Screen {
  id: string
  name: string
  /** Source screenshots per language; falls back through project languages. */
  images: Localized<AssetRef>
  background: Background
  device: DeviceSettings
  text: TextSettings
  copy: ScreenCopy
  elements: CanvasElement[]
  popouts: Popout[]
}

export interface PlatformDeck {
  id: string
  /** Id from the platform catalog, e.g. "app-store-iphone". */
  platformId: string
  /** Id of an output size within the platform, or "custom". */
  sizeId: string
  customSize: { width: number; height: number }
  /** Swaps the catalog size when the platform allows both orientations. */
  orientation: Orientation
  screens: Screen[]
}

export type VariantStatus = 'draft' | 'control' | 'testing' | 'winner' | 'archived'

export interface Variant {
  id: string
  name: string
  status: VariantStatus
  /** What this variant is testing, e.g. "Benefit-led headlines". */
  hypothesis: string
  decks: PlatformDeck[]
  createdAt: number
}

export interface Selection {
  variantId: string | null
  deckId: string | null
  screenId: string | null
  language: LangCode
}

export interface Project {
  id: string
  schemaVersion: number
  name: string
  appName: string
  languages: LangCode[]
  defaultLanguage: LangCode
  variants: Variant[]
  lastSelection: Selection
  createdAt: number
  updatedAt: number
}

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  variantCount: number
  screenCount: number
}
