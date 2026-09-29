// WebMCP tool specifications (names, descriptions, input schemas). Pure data:
// the /agents documentation page renders from this file, and tools.ts binds
// implementations to it, so docs and behaviour cannot drift apart.
//
// Tools are grouped by domain with an `action` parameter to keep the agent's
// tool list (and context usage) small while covering the whole editor.

import { GRADIENT_PRESETS, POSITION_PRESETS } from '../model/defaults'
import { PLATFORMS, STORES } from '../model/platforms'
import { arr, bool, enm, hex, int, num, obj, str, type JsonSchema } from './schema'

export interface ToolSpec {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: { readOnlyHint?: boolean; consequentialHint?: boolean }
  /** Short grouping label for the docs page. */
  group: 'Read' | 'Navigate' | 'Structure' | 'Copy & localization' | 'Design' | 'Output'
}

const PLATFORM_IDS = PLATFORMS.map(p => p.id)
const CHROME = ['none', 'phone', 'tablet', 'laptop', 'monitor', 'browser', 'window', 'tv', 'watch'] as const
const LAYERS = ['behind-device', 'above-device', 'above-text'] as const
const FRAMES = ['none', 'pill', 'outline-pill', 'laurel-simple', 'laurel-simple-star', 'laurel-detailed', 'laurel-detailed-star', 'badge-circle', 'badge-ribbon'] as const
const STATUSES = ['draft', 'control', 'testing', 'winner', 'archived'] as const

/** Shared targeting parameters for design tools. */
const target: Record<string, JsonSchema> = {
  screenId: str('Screen id. Defaults to the selected screen.'),
  screenIds: arr(str(), 'Several screen ids at once.', 1, 200),
  screenIndex: int('0-based screen position within deckId (or the selected platform); alternative to screenId.', 0),
  deckId: str('Platform deck id used with screenIndex or scope. Defaults to the selected platform.'),
  scope: enm(['screen', 'platform', 'variant'], 'screen (default): one screen. platform: every screen in the platform deck. variant: every screen of every platform in the selected variant.'),
}

const shadow = obj({
  enabled: bool(),
  color: hex(),
  blur: num('Blur radius in output px', 0, 400),
  opacity: num('0-100', 0, 100),
  x: num('Offset x in output px', -400, 400),
  y: num('Offset y in output px', -400, 400),
})

const textBlock = obj({
  enabled: bool('Show this line'),
  font: str('Google Fonts family (e.g. "Inter", "Plus Jakarta Sans", "Noto Sans JP") or a CSS font-family list'),
  size: num('Font size in output pixels', 4, 1000),
  weight: enm(['300', '400', '500', '600', '700', '800', '900']),
  color: hex(),
  opacity: num('0-100', 0, 100),
  italic: bool(),
  underline: bool(),
  strikethrough: bool(),
  uppercase: bool(),
  letterSpacing: num('Letter spacing in 1/100 em (e.g. -2 tight, 5 loose)', -20, 50),
})

const elementProps = obj(
  {
    name: str(),
    x: num('Center x in % of canvas width', -50, 150),
    y: num('Center y in % of canvas height', -50, 150),
    width: num('Width in % of canvas width', 1, 200),
    rotation: num('Degrees', -180, 180),
    opacity: num('0-100', 0, 100),
    layer: enm(LAYERS),
    font: str('text: font family'),
    fontSize: num('text: size in output px', 4, 1000),
    fontWeight: enm(['300', '400', '500', '600', '700', '800', '900']),
    color: hex('text/icon color'),
    italic: bool('text'),
    frame: enm(FRAMES, 'text: decorative frame — pill is a filled badge (text sits on frameColor)'),
    frameColor: hex('text: frame color'),
    frameScale: num('text: frame size %', 20, 300),
    emoji: str('emoji: the emoji character'),
    icon: str('icon: Lucide icon name, e.g. "star", "shield-check"'),
    strokeWidth: num('icon: stroke width', 0.5, 4),
    shadow,
  },
  [],
  'Element properties; only those matching the element kind apply.',
)

const popoutProps = obj({
  cropX: num('Crop left in % of the source screenshot', 0, 99),
  cropY: num('Crop top in %', 0, 99),
  cropWidth: num('Crop width in %', 1, 100),
  cropHeight: num('Crop height in %', 1, 100),
  x: num('Center x in % of canvas', -50, 150),
  y: num('Center y in % of canvas', -50, 150),
  width: num('Display width in % of canvas width', 1, 200),
  rotation: num('Degrees', -180, 180),
  opacity: num('0-100', 0, 100),
  cornerRadius: num('Corner radius', 0, 300),
  shadow,
  border: obj({ enabled: bool(), color: hex(), width: num('px', 0, 100), opacity: num('0-100', 0, 100) }),
})

export const TOOL_SPECS: ToolSpec[] = [
  // ------------------------------------------------------------------ read
  {
    name: 'get_app_state',
    title: 'Get app state',
    group: 'Read',
    description:
      'START HERE. Returns the open project (languages, variants → platform decks → screens with ids, image languages and headline/subheadline copy), all saved projects, the current selection and view, undo history and next-step hints. Image bytes are not included (use get_images). Call again after structural changes.',
    inputSchema: obj({
      variantId: str('Only include this variant'),
      includeCopy: bool('Include headline/subheadline text per screen (default true)'),
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_screen',
    title: 'Get screen design',
    group: 'Read',
    description:
      'Full design of one screen (default: selected): background, device, text style, copy per language, elements, popouts, image info, output size, plus computed layout (device and text rectangles in output px) and warnings such as text overlapping the device or running off-canvas.',
    inputSchema: obj({ screenId: target.screenId, screenIndex: target.screenIndex, deckId: target.deckId, language: str('Language used for layout warnings (default: current)') }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_platform_catalog',
    title: 'Get store platform catalog',
    group: 'Read',
    description: `Store screenshot specs: every platform id with its output sizes, orientation, screenshot count limits and requirements. Stores: ${STORES.map(s => s.id).join(', ')}.`,
    inputSchema: obj({ store: enm(STORES.map(s => s.id), 'Filter by store') }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_strings',
    title: 'Get localization strings',
    group: 'Read',
    description:
      'The localization table: every headline, subheadline and text-element string per language, with missing translations listed. Filter by variant/platform. Use before translating, then write with set_copy.',
    inputSchema: obj({
      variantId: str(),
      deckId: str(),
      languages: arr(str(), 'Only these languages'),
      onlyMissing: bool('Only rows with missing translations'),
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_images',
    title: 'Get images for vision',
    group: 'Read',
    description:
      'Images for visual QA. mode "rendered" (default) returns the styled composition exactly as exported, downscaled to maxDimension (default 900 px, JPEG). mode "original" returns uploaded source screenshots (use to read the app UI before writing copy). Waits for fonts, images and 3D models. Target with screenId/screenIds/screenIndex or scope.',
    inputSchema: obj({
      ...target,
      language: str('Language to render (default: current)'),
      mode: enm(['rendered', 'original']),
      maxDimension: int('Longest side in px (200-1600, default 900). Never upscales.', 200, 1600),
      format: enm(['jpeg', 'png'], 'Default jpeg (smaller for agent context)'),
      maxImages: int('Cap for multi-screen requests (default 6)', 1, 12),
    }),
    annotations: { readOnlyHint: true },
  },
  // ------------------------------------------------------------------ navigate
  {
    name: 'select',
    title: 'Select variant, platform, screen or language',
    group: 'Navigate',
    description:
      'Moves the editor focus so the user sees what you work on: variantId (A/B variant), deckId (platform), screenId or screenIndex, and language (preview language). Switching variant keeps the same platform and screen position when possible.',
    inputSchema: obj({ variantId: str(), deckId: str(), screenId: str(), screenIndex: int(undefined, 0), language: str('Project language code, e.g. "de"') }),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'set_view',
    title: 'Change editor view',
    group: 'Navigate',
    description:
      'Controls the editor UI: view (design = single screen canvas, board = all screens × languages grid, strings = localization table, compare = A/B variants side by side), inspectorTab, selected element/popout, which variants to compare, and the store safe-area overlay.',
    inputSchema: obj({
      view: enm(['design', 'board', 'strings', 'compare']),
      inspectorTab: enm(['background', 'device', 'text', 'elements', 'popouts']),
      selectedElementId: str('Element id or "" to clear'),
      selectedPopoutId: str('Popout id or "" to clear'),
      compareVariantIds: arr(str(), 'Variants shown in compare view (2-4)', 1, 4),
      showSafeArea: bool(),
    }),
    annotations: { readOnlyHint: false },
  },
  // ------------------------------------------------------------------ structure
  {
    name: 'manage_project',
    title: 'Manage projects',
    group: 'Structure',
    description:
      'Projects are the top-level container (one per app). Actions: create {name, appName?, platformIds?, languages?} — new project with an "Original" variant; open {projectId}; rename {name, appName?}; duplicate {projectId?, name?}; delete {projectId, confirm:true} (permanent); export_file {projectId?} downloads a .storedeck.json backup for the user; import_file {bundle} imports a backup (object or JSON string).',
    inputSchema: obj(
      {
        action: enm(['create', 'open', 'rename', 'duplicate', 'delete', 'export_file', 'import_file']),
        name: str('Project name (1-100 chars)', { minLength: 1, maxLength: 100 }),
        appName: str('App name used in guides/exports'),
        projectId: str(),
        platformIds: arr(enm(PLATFORM_IDS), 'create: initial platforms (default app-store-iphone)'),
        languages: arr(str(), 'create: initial languages (default ["en"])'),
        confirm: bool('delete: must be true'),
        bundle: { description: 'import_file: project bundle object or JSON string' },
      },
      ['action'],
    ),
    annotations: { readOnlyHint: false, consequentialHint: true },
  },
  {
    name: 'manage_variant',
    title: 'Manage A/B variants',
    group: 'Structure',
    description:
      'Variants are alternative screenshot sets for A/B tests (App Store Product Page Optimization, Google Play store listing experiments). Actions: create {name?, cloneFromVariantId?, blank?, platformIds?} — clones the selected variant by default so you only change what the test is about; update {variantId, name?, status?, hypothesis?} (status draft|control|testing|winner|archived — one control/winner at a time); delete {variantId}; move {variantId, toIndex}.',
    inputSchema: obj(
      {
        action: enm(['create', 'update', 'delete', 'move']),
        variantId: str(),
        name: str(undefined, { minLength: 1, maxLength: 80 }),
        cloneFromVariantId: str(),
        blank: bool('create: start with empty platforms instead of cloning'),
        platformIds: arr(enm(PLATFORM_IDS), 'create+blank: platforms to add'),
        status: enm(STATUSES),
        hypothesis: str('What this variant tests, e.g. "Benefit-first headlines lift installs"', { maxLength: 500 }),
        toIndex: int(undefined, 0),
      },
      ['action'],
    ),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'manage_platform',
    title: 'Manage store platforms',
    group: 'Structure',
    description:
      'Each variant holds one deck per store platform (iPhone, iPad, Android phone, Mac, Apple TV, Android TV, Windows, Steam, Fire TV, …; ids via get_platform_catalog). Actions: add {platformId, sizeId?, variantId?, cloneFromDeckId?, allVariants?} — cloneFromDeckId copies screens, images and copy and rescales the design to the new size (the fastest way to go from iPhone to Android/iPad); remove {deckId}; set_size {deckId?, sizeId? | width+height, orientation?} — design values rescale automatically.',
    inputSchema: obj(
      {
        action: enm(['add', 'remove', 'set_size']),
        platformId: enm(PLATFORM_IDS),
        sizeId: str('Size id from the catalog, or "custom" with width/height'),
        variantId: str(),
        deckId: str(),
        cloneFromDeckId: str(),
        allVariants: bool('add: add to every variant'),
        width: int('set_size: custom width', 100, 8000),
        height: int('set_size: custom height', 100, 8000),
        orientation: enm(['portrait', 'landscape']),
      },
      ['action'],
    ),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'manage_screens',
    title: 'Manage screens',
    group: 'Structure',
    description:
      'Screens are the individual store images of a platform deck. Actions: upload {screenshots:[{filename, dataUrl, language?}], deckId?, screenId?} — PNG/JPEG data URLs, max 10 per call; language suffixes in filenames (home_de.png, home-pt-br.png) are detected, and files whose base name matches an existing screen become its localized image; new screens copy the selected screen\'s style. add_blank {deckId?, name?}; delete {screenId}; duplicate {screenId}; move {screenId, toIndex} (store order); rename {screenId, name}; remove_image {screenId, language}.',
    inputSchema: obj(
      {
        action: enm(['upload', 'add_blank', 'delete', 'duplicate', 'move', 'rename', 'remove_image']),
        screenshots: arr(
          obj({ filename: str('e.g. "home_de.png"'), dataUrl: str('data:image/png;base64,...'), language: str('Overrides filename detection') }, ['filename', 'dataUrl']),
          'upload: images',
          1,
          10,
        ),
        deckId: str(),
        screenId: str(),
        screenIndex: int(undefined, 0),
        name: str(undefined, { minLength: 1, maxLength: 120 }),
        toIndex: int(undefined, 0),
        language: str(),
      },
      ['action'],
    ),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'manage_languages',
    title: 'Manage languages',
    group: 'Copy & localization',
    description:
      'Project languages (lower-case BCP-47 like "de", "pt-br", "zh-tw", "te"). Actions: add {languages:[...]}, remove {language} (copy is kept and returns if re-added), set_default {language} (fallback for missing copy/images), switch {language} (preview language — same as select).',
    inputSchema: obj({ action: enm(['add', 'remove', 'set_default', 'switch']), language: str(), languages: arr(str(), undefined, 1, 60) }, ['action']),
    annotations: { readOnlyHint: false },
  },
  // ------------------------------------------------------------------ copy
  {
    name: 'set_copy',
    title: 'Write headlines & translations',
    group: 'Copy & localization',
    description:
      'Writes store copy (the words, not styling) in bulk. Each entry targets a screen (screenId, or screenIndex + optional deckId), a field (headline, subheadline, or "element:<elementId>" for text badges), a language and text. Languages are added to the project automatically. Copywriting: headline 2–5 words, benefit-first; subheadline 4–10 words that expand it; every screen tells a different part of the story and screen 1 carries the core value proposition. Use \\n for manual line breaks. Prefer one call with all entries.',
    inputSchema: obj(
      {
        entries: arr(
          obj(
            {
              screenId: str(),
              screenIndex: int(undefined, 0),
              deckId: str(),
              field: str('headline | subheadline | element:<id>'),
              language: str(),
              text: str(undefined, { maxLength: 1000 }),
            },
            ['field', 'language', 'text'],
          ),
          undefined,
          1,
          300,
        ),
      },
      ['entries'],
    ),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'copy_strings',
    title: 'Copy strings between platforms',
    group: 'Copy & localization',
    description: 'Copies headline/subheadline copy from one platform deck to another by screen position (e.g. reuse iPhone copy for Android). Optional languages filter.',
    inputSchema: obj({ fromDeckId: str(), toDeckId: str(), languages: arr(str()) }, ['fromDeckId', 'toDeckId']),
    annotations: { readOnlyHint: false },
  },
  // ------------------------------------------------------------------ design
  {
    name: 'set_background',
    title: 'Set background',
    group: 'Design',
    description: `Background of the targeted screens: type gradient|solid|image; gradient {kind linear|radial, angle (CSS degrees, 0 = up), stops [{color, position 0-100}]}; gradientPreset (${GRADIENT_PRESETS.map(g => g.name).join(', ')}); solid; imageDataUrl (sets type image); imageFit cover|contain|stretch; imageBlur; overlayColor/overlayOpacity (tint for contrast); noise/noiseIntensity.`,
    inputSchema: obj({
      ...target,
      type: enm(['gradient', 'solid', 'image']),
      gradient: obj({ kind: enm(['linear', 'radial']), angle: num('CSS angle in degrees', 0, 360), stops: arr(obj({ color: hex(), position: num(undefined, 0, 100) }, ['color', 'position']), undefined, 2, 8) }),
      gradientPreset: enm(GRADIENT_PRESETS.map(g => g.name)),
      solid: hex(),
      imageDataUrl: str('data:image/... background image'),
      imageFit: enm(['cover', 'contain', 'stretch']),
      imageBlur: num('px', 0, 100),
      overlayColor: hex(),
      overlayOpacity: num('0-100', 0, 100),
      noise: bool(),
      noiseIntensity: num('0-100', 0, 100),
    }),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'set_device',
    title: 'Set device frame & placement',
    group: 'Design',
    description: `How the screenshot is presented. preset (${Object.entries(POSITION_PRESETS).map(([k, v]) => `${k}: ${v.label}`).join('; ')}) — explicit fields override it. scale (% of canvas width), x/y (50 = centered; <0 or >100 bleeds off-canvas), rotation, perspective, cornerRadius; chrome {style: ${CHROME.join('|')}, color} draws a 2D device frame (phone for mobile, laptop/window/browser for desktop, tv for TV); use3D with model3D iphone|samsung, modelColor and rotation3D {x,y,z}; shadow {...}; border {...} (outline stroke).`,
    inputSchema: obj({
      ...target,
      preset: enm(Object.keys(POSITION_PRESETS)),
      scale: num('% of canvas width', 10, 150),
      x: num(undefined, -100, 200),
      y: num(undefined, -100, 200),
      rotation: num('Degrees', -180, 180),
      perspective: num('Shear -50..50', -50, 50),
      cornerRadius: num(undefined, 0, 200),
      chrome: obj({ style: enm(CHROME), color: hex('Bezel color') }),
      use3D: bool(),
      model3D: enm(['iphone', 'samsung']),
      modelColor: str('iphone: natural|blue|white|black|desert|deep-purple|gold|red; samsung: gray|black|silverblue|whitesilver|pinkgold|jadegreen|jetblack'),
      rotation3D: obj({ x: num(undefined, -60, 60), y: num(undefined, -60, 60), z: num(undefined, -60, 60) }),
      shadow,
      border: obj({ enabled: bool(), color: hex(), width: num(undefined, 0, 100), opacity: num(undefined, 0, 100) }),
    }),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'set_text_style',
    title: 'Style headline & subheadline',
    group: 'Design',
    description:
      'Typography and layout of the headline/subheadline (content is set with set_copy). headline/subheadline {enabled, font, size (output px), weight, color, opacity, italic, underline, strikethrough, uppercase, letterSpacing}; position top|bottom; align left|center|right (mirrored automatically for RTL languages); offsetY (% from edge); x (block center %) and maxWidth (% of width) for side-by-side layouts; lineHeight (%); gap (% of headline size). With language set, headline/subheadline size, offsetY and lineHeight are stored as an override for that language only (for long German or short CJK copy); resetLanguageOverride removes it.',
    inputSchema: obj({
      ...target,
      language: str('Store size/offset/lineHeight as a per-language override'),
      resetLanguageOverride: bool(),
      headline: textBlock,
      subheadline: textBlock,
      position: enm(['top', 'bottom']),
      align: enm(['left', 'center', 'right']),
      offsetY: num('% from top/bottom edge', -50, 100),
      x: num('Text block center in % of width', 0, 100),
      maxWidth: num('% of canvas width', 10, 100),
      lineHeight: num('%', 50, 300),
      gap: num('% of headline size', 0, 300),
    }),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'manage_elements',
    title: 'Manage overlay elements',
    group: 'Design',
    description:
      'Floating overlays on a screen (badges, awards, emoji, icons, logos — not the headline). Actions: add {kind: text|emoji|icon|image, text+language (text), emoji, icon (Lucide name), imageDataUrl (image), properties?}; update {elementId, properties?, text?, language?}; delete {elementId}; reorder {elementId, toIndex} (later = on top). Layers: behind-device, above-device, above-text.',
    inputSchema: obj(
      {
        action: enm(['add', 'update', 'delete', 'reorder']),
        screenId: target.screenId,
        screenIndex: target.screenIndex,
        deckId: target.deckId,
        elementId: str(),
        kind: enm(['text', 'emoji', 'icon', 'image']),
        text: str(undefined, { maxLength: 500 }),
        language: str(),
        emoji: str(),
        icon: str(),
        imageDataUrl: str(),
        properties: elementProps,
        toIndex: int(undefined, 0),
      },
      ['action'],
    ),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'manage_popouts',
    title: 'Manage magnified popouts',
    group: 'Design',
    description:
      'Popouts crop a region of the screen\'s source screenshot and show it enlarged (callouts for key UI). Actions: add {properties?}, update {popoutId, properties}, delete {popoutId}. Crop values are % of the source image; placement is % of the canvas.',
    inputSchema: obj(
      {
        action: enm(['add', 'update', 'delete']),
        screenId: target.screenId,
        screenIndex: target.screenIndex,
        deckId: target.deckId,
        popoutId: str(),
        properties: popoutProps,
      },
      ['action'],
    ),
    annotations: { readOnlyHint: false },
  },
  {
    name: 'transfer_style',
    title: 'Copy design to other screens',
    group: 'Design',
    description:
      'Copies design from a source screen to targets — across screens, platforms or variants. Copy (words) and screenshots stay with each target; pixel values rescale when sizes differ. parts selects background/device/text/elements (all by default). Targets: targetScreenIds, or targetScope platform (source deck) | variant (every deck in source variant) | project (everything).',
    inputSchema: obj(
      {
        sourceScreenId: str(),
        sourceScreenIndex: int(undefined, 0),
        deckId: str('Deck for sourceScreenIndex'),
        targetScreenIds: arr(str(), undefined, 1, 500),
        targetScope: enm(['platform', 'variant', 'project']),
        parts: obj({ background: bool(), device: bool(), text: bool(), elements: bool() }),
      },
    ),
    annotations: { readOnlyHint: false },
  },
  // ------------------------------------------------------------------ output
  {
    name: 'export',
    title: 'Export store images',
    group: 'Output',
    description:
      'Renders full-resolution store images. delivery "return" (default) returns data URLs to save as files (max 24 per call — narrow with screenIds/deckIds/languages). delivery "download" builds a ZIP in the browser for the user (variant/platform-WxH/lang/NN-name.png). Defaults: selected platform deck, current language, PNG. JPEG is flattened (stores reject alpha).',
    inputSchema: obj({
      variantIds: arr(str()),
      deckIds: arr(str()),
      screenIds: arr(str()),
      languages: arr(str()),
      allLanguages: bool('Every project language'),
      allPlatforms: bool('Every deck of the selected variant(s)'),
      format: enm(['png', 'jpeg']),
      delivery: enm(['return', 'download']),
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'history',
    title: 'Undo / redo',
    group: 'Output',
    description: 'Undo or redo document changes (yours and the user\'s). steps defaults to 1.',
    inputSchema: obj({ action: enm(['undo', 'redo']), steps: int(undefined, 1, 50) }, ['action']),
    annotations: { readOnlyHint: false },
  },
]

export const TOOL_NAMES = TOOL_SPECS.map(t => t.name)
