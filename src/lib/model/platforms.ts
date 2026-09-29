// Store + device-class catalog. Sizes were checked against the official store
// documentation on SPEC_REVIEWED; each platform links its source so the
// guides and the editor can show where the numbers come from.

import type { ChromeStyle, Model3D, Orientation } from './types'

export const SPEC_REVIEWED = '2026-09-29'

export type StoreId = 'app-store' | 'google-play' | 'microsoft-store' | 'steam' | 'amazon-appstore' | 'tv-stores' | 'web'
export type PlatformCategory = 'phone' | 'tablet' | 'desktop' | 'tv' | 'wearable' | 'xr' | 'car' | 'artwork'

export interface OutputSize {
  id: string
  label: string
  width: number
  height: number
  note?: string
}

export interface PlatformSpec {
  id: string
  store: StoreId
  name: string
  category: PlatformCategory
  /** Orientation of the sizes as listed. */
  orientation: Orientation | 'square'
  /** Whether the store also accepts the swapped orientation. */
  rotatable: boolean
  sizes: OutputSize[]
  defaultSizeId: string
  screenshots: { min: number; max?: number }
  formats: string
  requirements: string[]
  /** Constraints used to validate custom sizes. */
  rules?: { minSide?: number; maxSide?: number; maxAspect?: number; aspects?: Array<[number, number]> }
  defaultChrome: ChromeStyle
  models3D: Model3D[]
  sourceUrl: string
}

export interface StoreSpec {
  id: StoreId
  name: string
  slug: string
  tagline: string
  sourceUrl: string
}

export const STORES: StoreSpec[] = [
  {
    id: 'app-store',
    name: 'Apple App Store',
    slug: 'app-store',
    tagline: 'iPhone, iPad, Mac, Apple TV, Apple Vision Pro and Apple Watch listings in App Store Connect.',
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  {
    id: 'google-play',
    name: 'Google Play',
    slug: 'google-play',
    tagline: 'Phones, tablets, Chromebooks, Android TV, Wear OS, Android XR and Android Automotive in Play Console.',
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'microsoft-store',
    name: 'Microsoft Store',
    slug: 'microsoft-store',
    tagline: 'Windows desktop and Xbox listings in Partner Center.',
    sourceUrl: 'https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images',
  },
  {
    id: 'steam',
    name: 'Steam',
    slug: 'steam',
    tagline: 'Store page screenshots and capsule artwork in Steamworks.',
    sourceUrl: 'https://partner.steamgames.com/doc/store/assets',
  },
  {
    id: 'amazon-appstore',
    name: 'Amazon Appstore',
    slug: 'amazon-appstore',
    tagline: 'Fire TV and Fire tablet listings in the Amazon Developer Console.',
    sourceUrl: 'https://developer.amazon.com/docs/app-submission/appstore-details.html',
  },
  {
    id: 'tv-stores',
    name: 'Smart TV stores',
    slug: 'tv-stores',
    tagline: 'Generic 16:9 artwork for Samsung, LG, Roku and other TV storefronts.',
    sourceUrl: 'https://developer.samsung.com/smarttv/develop/distribute/seller-office.html',
  },
  {
    id: 'web',
    name: 'Web & social',
    slug: 'web',
    tagline: 'Open Graph cards, social posts, launch galleries and landing-page heroes.',
    sourceUrl: 'https://ogp.me/',
  },
]

const size = (id: string, label: string, width: number, height: number, note?: string): OutputSize => ({ id, label, width, height, note })

export const PLATFORMS: PlatformSpec[] = [
  // ---------------------------------------------------------------- Apple
  {
    id: 'app-store-iphone',
    store: 'app-store',
    name: 'iPhone',
    category: 'phone',
    orientation: 'portrait',
    rotatable: true,
    sizes: [
      size('iphone-6.9', '6.9" display', 1320, 2868, 'iPhone 16/17 Pro Max, iPhone Air'),
      size('iphone-6.9-1290', '6.9" display (1290)', 1290, 2796, 'iPhone 15 Pro Max, 14 Pro Max'),
      size('iphone-6.9-1260', '6.9" display (1260)', 1260, 2736),
      size('iphone-6.5', '6.5" display', 1284, 2778, 'iPhone 14 Plus, 13 Pro Max'),
      size('iphone-6.5-1242', '6.5" display (1242)', 1242, 2688, 'iPhone 11 Pro Max, XS Max'),
      size('iphone-6.3', '6.3" display', 1206, 2622, 'iPhone 16/17 Pro'),
      size('iphone-6.3-1179', '6.3" display (1179)', 1179, 2556, 'iPhone 15, 14 Pro'),
      size('iphone-6.1', '6.1" display', 1170, 2532, 'iPhone 14, 13, 12'),
      size('iphone-5.5', '5.5" display', 1242, 2208, 'iPhone 8 Plus'),
      size('iphone-4.7', '4.7" display', 750, 1334, 'iPhone SE'),
    ],
    defaultSizeId: 'iphone-6.9',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG, no transparency',
    requirements: [
      'Provide 6.9" screenshots (or 6.5" if you skip 6.9") — App Store Connect scales them down for smaller iPhones.',
      'Up to 10 screenshots per localization; the first 3 show in search results.',
      'Images cannot contain alpha channels or transparency.',
    ],
    defaultChrome: 'phone',
    models3D: ['iphone'],
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  {
    id: 'app-store-ipad',
    store: 'app-store',
    name: 'iPad',
    category: 'tablet',
    orientation: 'portrait',
    rotatable: true,
    sizes: [
      size('ipad-13', '13" display', 2064, 2752, 'iPad Pro M4/M5, iPad Air M2+'),
      size('ipad-12.9', '12.9" display', 2048, 2732, 'iPad Pro (2nd gen)'),
      size('ipad-11', '11" display', 1668, 2388, 'iPad Pro 11"'),
      size('ipad-11-2420', '11" display (2420)', 1668, 2420),
      size('ipad-11-1640', '11" display (1640)', 1640, 2360, 'iPad 10th gen, iPad Air'),
      size('ipad-11-1488', '11" display (1488)', 1488, 2266, 'iPad mini'),
      size('ipad-10.5', '10.5" display', 1668, 2224),
    ],
    defaultSizeId: 'ipad-13',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG, no transparency',
    requirements: [
      '13" iPad screenshots are required if your app runs on iPad.',
      'Portrait and landscape are both accepted — keep one orientation per set.',
    ],
    defaultChrome: 'tablet',
    models3D: [],
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  {
    id: 'app-store-mac',
    store: 'app-store',
    name: 'Mac',
    category: 'desktop',
    orientation: 'landscape',
    rotatable: false,
    sizes: [
      size('mac-2880', '2880 × 1800', 2880, 1800, 'Retina 16:10'),
      size('mac-2560', '2560 × 1600', 2560, 1600, 'Retina 16:10'),
      size('mac-1440', '1440 × 900', 1440, 900),
      size('mac-1280', '1280 × 800', 1280, 800),
    ],
    defaultSizeId: 'mac-2880',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG, no transparency',
    requirements: ['All Mac screenshots use a 16:10 aspect ratio.', 'Required for Mac apps.'],
    defaultChrome: 'window',
    models3D: [],
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  {
    id: 'app-store-apple-tv',
    store: 'app-store',
    name: 'Apple TV',
    category: 'tv',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('appletv-4k', '4K', 3840, 2160), size('appletv-hd', 'HD', 1920, 1080)],
    defaultSizeId: 'appletv-4k',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG, no transparency',
    requirements: ['Required for tvOS apps.', 'Show the focus-driven TV interface at 10-foot viewing distance.'],
    defaultChrome: 'tv',
    models3D: [],
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  {
    id: 'app-store-vision-pro',
    store: 'app-store',
    name: 'Apple Vision Pro',
    category: 'xr',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('visionpro', '3840 × 2160', 3840, 2160)],
    defaultSizeId: 'visionpro',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG, no transparency',
    requirements: ['Required for visionOS apps.'],
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  {
    id: 'app-store-watch',
    store: 'app-store',
    name: 'Apple Watch',
    category: 'wearable',
    orientation: 'portrait',
    rotatable: false,
    sizes: [
      size('watch-ultra-3', 'Ultra 3 / Ultra 4', 422, 514),
      size('watch-ultra', 'Ultra / Ultra 2', 410, 502),
      size('watch-s10', 'Series 10–12', 416, 496),
      size('watch-s7', 'Series 7–9', 396, 484),
      size('watch-s4', 'Series 4–6, SE', 368, 448),
    ],
    defaultSizeId: 'watch-ultra-3',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG, no transparency',
    requirements: ['Use the same watch size consistently across all localizations.'],
    defaultChrome: 'watch',
    models3D: [],
    sourceUrl: 'https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications',
  },
  // ---------------------------------------------------------------- Google
  {
    id: 'google-play-phone',
    store: 'google-play',
    name: 'Android phone',
    category: 'phone',
    orientation: 'portrait',
    rotatable: true,
    sizes: [
      size('android-phone', '1080 × 1920 (9:16)', 1080, 1920, 'Promotion-ready minimum'),
      size('android-phone-hd', '1440 × 2560 (9:16)', 1440, 2560),
      size('android-phone-4k', '2160 × 3840 (9:16)', 2160, 3840, 'Largest allowed'),
    ],
    defaultSizeId: 'android-phone',
    screenshots: { min: 2, max: 8 },
    formats: 'JPEG or 24-bit PNG, no alpha',
    requirements: [
      'Sides between 320 px and 3,840 px; the long side can be at most twice the short side.',
      'At least 4 screenshots of 1080 px or more in 9:16 (or 16:9) to be eligible for promotion.',
      'Up to 8 screenshots per device type.',
    ],
    rules: { minSide: 320, maxSide: 3840, maxAspect: 2 },
    defaultChrome: 'phone',
    models3D: ['samsung'],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-tablet-7',
    store: 'google-play',
    name: '7-inch tablet',
    category: 'tablet',
    orientation: 'portrait',
    rotatable: true,
    sizes: [size('android-tablet-7', '1080 × 1920 (9:16)', 1080, 1920)],
    defaultSizeId: 'android-tablet-7',
    screenshots: { min: 4, max: 8 },
    formats: 'JPEG or 24-bit PNG, no alpha',
    requirements: ['Large-screen screenshots: 9:16 portrait or 16:9 landscape.', 'Add at least 4 to be featured on large screens.'],
    rules: { minSide: 320, maxSide: 3840, aspects: [[9, 16], [16, 9]] },
    defaultChrome: 'tablet',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-tablet-10',
    store: 'google-play',
    name: '10-inch tablet',
    category: 'tablet',
    orientation: 'portrait',
    rotatable: true,
    sizes: [
      size('android-tablet-10', '1440 × 2560 (9:16)', 1440, 2560),
      size('android-tablet-10-4k', '2160 × 3840 (9:16)', 2160, 3840),
    ],
    defaultSizeId: 'android-tablet-10',
    screenshots: { min: 4, max: 8 },
    formats: 'JPEG or 24-bit PNG, no alpha',
    requirements: ['Sides between 1,080 px and 7,680 px.', '9:16 portrait or 16:9 landscape.'],
    rules: { minSide: 1080, maxSide: 7680, aspects: [[9, 16], [16, 9]] },
    defaultChrome: 'tablet',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-chromebook',
    store: 'google-play',
    name: 'Chromebook',
    category: 'desktop',
    orientation: 'landscape',
    rotatable: true,
    sizes: [size('chromebook', '1920 × 1080 (16:9)', 1920, 1080), size('chromebook-4k', '3840 × 2160 (16:9)', 3840, 2160)],
    defaultSizeId: 'chromebook',
    screenshots: { min: 4, max: 8 },
    formats: 'JPEG or 24-bit PNG, no alpha',
    requirements: ['Sides between 1,080 px and 7,680 px, 16:9 or 9:16.'],
    rules: { minSide: 1080, maxSide: 7680, aspects: [[16, 9], [9, 16]] },
    defaultChrome: 'laptop',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-tv',
    store: 'google-play',
    name: 'Android TV / Google TV',
    category: 'tv',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('android-tv', '1920 × 1080', 1920, 1080), size('android-tv-4k', '3840 × 2160', 3840, 2160)],
    defaultSizeId: 'android-tv',
    screenshots: { min: 1, max: 8 },
    formats: 'JPEG or 24-bit PNG, no alpha',
    requirements: ['At least one Android TV screenshot is required to publish for TV.', 'A 1280 × 720 TV banner is also required (see Artwork).'],
    defaultChrome: 'tv',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-wear',
    store: 'google-play',
    name: 'Wear OS',
    category: 'wearable',
    orientation: 'square',
    rotatable: false,
    sizes: [size('wear-480', '480 × 480', 480, 480), size('wear-384', '384 × 384 (minimum)', 384, 384)],
    defaultSizeId: 'wear-480',
    screenshots: { min: 1, max: 8 },
    formats: 'PNG or JPEG',
    requirements: ['1:1 aspect ratio, at least 384 × 384 px.', 'Google\'s Wear OS quality guidelines favour plain app UI captures — keep frames and overlays minimal.'],
    rules: { minSide: 384, aspects: [[1, 1]] },
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-xr',
    store: 'google-play',
    name: 'Android XR',
    category: 'xr',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('android-xr', '3840 × 2400 (8:5)', 3840, 2400), size('android-xr-min', '1920 × 1200 (8:5)', 1920, 1200)],
    defaultSizeId: 'android-xr',
    screenshots: { min: 4, max: 8 },
    formats: 'PNG or JPEG, up to 8 MB',
    requirements: ['8:5 aspect ratio; 3840 × 2400 recommended, 1920 × 1200 minimum.'],
    rules: { minSide: 1200, aspects: [[8, 5]] },
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-automotive',
    store: 'google-play',
    name: 'Android Automotive',
    category: 'car',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('automotive-landscape', '1024 × 768', 1024, 768), size('automotive-portrait', '800 × 1280', 800, 1280)],
    defaultSizeId: 'automotive-landscape',
    screenshots: { min: 2, max: 8 },
    formats: 'PNG or JPEG',
    requirements: ['At least 2 screenshots in either 1024 × 768 landscape or 800 × 1280 portrait.'],
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  {
    id: 'google-play-artwork',
    store: 'google-play',
    name: 'Play artwork',
    category: 'artwork',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('feature-graphic', 'Feature graphic', 1024, 500), size('tv-banner', 'TV banner', 1280, 720)],
    defaultSizeId: 'feature-graphic',
    screenshots: { min: 1, max: 1 },
    formats: 'JPEG or 24-bit PNG, no alpha',
    requirements: ['The feature graphic appears above your listing and in promotions.', 'Keep key content away from the edges — it can be cropped.'],
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/9866151',
  },
  // ---------------------------------------------------------------- Microsoft
  {
    id: 'ms-store-desktop',
    store: 'microsoft-store',
    name: 'Windows desktop',
    category: 'desktop',
    orientation: 'landscape',
    rotatable: true,
    sizes: [
      size('ms-desktop-4k', '3840 × 2160 (4K)', 3840, 2160),
      size('ms-desktop-1080', '1920 × 1080', 1920, 1080),
      size('ms-desktop-1366', '1366 × 768 (minimum)', 1366, 768),
    ],
    defaultSizeId: 'ms-desktop-1080',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG, up to 50 MB',
    requirements: [
      '1366 × 768 or larger, up to 4K.',
      'Keep critical visuals in the top two-thirds — the Store can overlay the bottom third.',
      'Captions (200 characters) are entered separately in Partner Center.',
    ],
    rules: { minSide: 768, maxSide: 3840 },
    defaultChrome: 'window',
    models3D: [],
    sourceUrl: 'https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images',
  },
  {
    id: 'ms-store-xbox',
    store: 'microsoft-store',
    name: 'Xbox',
    category: 'tv',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('xbox-4k', '3840 × 2160 (4K)', 3840, 2160), size('xbox-1080', '1920 × 1080', 1920, 1080)],
    defaultSizeId: 'xbox-1080',
    screenshots: { min: 1, max: 8 },
    formats: 'PNG, up to 50 MB',
    requirements: ['Between 1920 × 1080 and 4K.'],
    rules: { minSide: 1080, maxSide: 3840 },
    defaultChrome: 'tv',
    models3D: [],
    sourceUrl: 'https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images',
  },
  // ---------------------------------------------------------------- Steam
  {
    id: 'steam-screenshots',
    store: 'steam',
    name: 'Steam screenshots',
    category: 'desktop',
    orientation: 'landscape',
    rotatable: false,
    sizes: [
      size('steam-1080', '1920 × 1080', 1920, 1080),
      size('steam-1440', '2560 × 1440', 2560, 1440),
      size('steam-4k', '3840 × 2160', 3840, 2160),
    ],
    defaultSizeId: 'steam-1080',
    screenshots: { min: 5 },
    formats: 'PNG or JPEG',
    requirements: ['16:9, at least 1920 × 1080.', 'Upload at least 5 screenshots.', 'Steam expects gameplay screenshots — keep overlays subtle.'],
    rules: { minSide: 1080, aspects: [[16, 9]] },
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://partner.steamgames.com/doc/store/assets',
  },
  {
    id: 'steam-capsules',
    store: 'steam',
    name: 'Steam capsules',
    category: 'artwork',
    orientation: 'landscape',
    rotatable: false,
    sizes: [
      size('steam-header', 'Header capsule', 920, 430),
      size('steam-small', 'Small capsule', 462, 174),
      size('steam-main', 'Main capsule', 1232, 706),
      size('steam-vertical', 'Vertical capsule', 748, 896),
      size('steam-library', 'Library capsule', 600, 900),
      size('steam-hero', 'Library hero', 3840, 1240),
    ],
    defaultSizeId: 'steam-header',
    screenshots: { min: 1, max: 1 },
    formats: 'PNG or JPEG',
    requirements: ['Capsules should contain only the game logo and artwork.'],
    defaultChrome: 'none',
    models3D: [],
    sourceUrl: 'https://partner.steamgames.com/doc/store/assets',
  },
  // ---------------------------------------------------------------- Amazon
  {
    id: 'amazon-fire-tv',
    store: 'amazon-appstore',
    name: 'Fire TV',
    category: 'tv',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('firetv', '1920 × 1080', 1920, 1080)],
    defaultSizeId: 'firetv',
    screenshots: { min: 3, max: 10 },
    formats: 'JPEG or 24-bit PNG, no transparency',
    requirements: ['3 to 10 landscape screenshots at exactly 1920 × 1080.'],
    defaultChrome: 'tv',
    models3D: [],
    sourceUrl: 'https://developer.amazon.com/docs/app-submission/appstore-details.html',
  },
  {
    id: 'amazon-fire-tablet',
    store: 'amazon-appstore',
    name: 'Fire tablet',
    category: 'tablet',
    orientation: 'landscape',
    rotatable: true,
    sizes: [
      size('fire-2560', '2560 × 1600', 2560, 1600),
      size('fire-1920x1200', '1920 × 1200', 1920, 1200),
      size('fire-1920x1080', '1920 × 1080', 1920, 1080),
      size('fire-1280x800', '1280 × 800', 1280, 800),
    ],
    defaultSizeId: 'fire-1920x1200',
    screenshots: { min: 3, max: 10 },
    formats: 'PNG or JPEG',
    requirements: ['3 to 10 screenshots, landscape or portrait, in one of the listed sizes.'],
    defaultChrome: 'tablet',
    models3D: [],
    sourceUrl: 'https://developer.amazon.com/docs/app-submission/appstore-details.html',
  },
  // ---------------------------------------------------------------- TV
  {
    id: 'smart-tv',
    store: 'tv-stores',
    name: 'Smart TV (16:9)',
    category: 'tv',
    orientation: 'landscape',
    rotatable: false,
    sizes: [size('tv-1080', '1920 × 1080', 1920, 1080), size('tv-4k', '3840 × 2160', 3840, 2160)],
    defaultSizeId: 'tv-1080',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG',
    requirements: ['Generic 16:9 TV artwork for Samsung, LG, Roku and similar stores — confirm exact counts in each seller portal.'],
    defaultChrome: 'tv',
    models3D: [],
    sourceUrl: 'https://developer.samsung.com/smarttv/develop/distribute/seller-office.html',
  },
  // ---------------------------------------------------------------- Web
  {
    id: 'web-social',
    store: 'web',
    name: 'Web & social',
    category: 'artwork',
    orientation: 'landscape',
    rotatable: false,
    sizes: [
      size('web-og', 'Open Graph', 1200, 630),
      size('web-twitter', 'X / Twitter', 1200, 675),
      size('web-hero', 'Landing hero', 1920, 1080),
      size('web-product-hunt', 'Product Hunt gallery', 1270, 760),
      size('web-square', 'Square post', 1080, 1080),
      size('web-story', 'Story / Reel', 1080, 1920),
    ],
    defaultSizeId: 'web-og',
    screenshots: { min: 1, max: 10 },
    formats: 'PNG or JPEG',
    requirements: ['Use for launch posts, link previews and landing pages.'],
    defaultChrome: 'browser',
    models3D: [],
    sourceUrl: 'https://ogp.me/',
  },
]

const platformIndex = new Map(PLATFORMS.map(p => [p.id, p]))

export function getPlatform(id: string): PlatformSpec | undefined {
  return platformIndex.get(id)
}

export function requirePlatform(id: string): PlatformSpec {
  const p = platformIndex.get(id)
  if (!p) throw new Error(`Unknown platform "${id}". Known: ${PLATFORMS.map(x => x.id).join(', ')}`)
  return p
}

export function getStore(id: StoreId): StoreSpec {
  return STORES.find(s => s.id === id)!
}

export function platformsForStore(id: StoreId): PlatformSpec[] {
  return PLATFORMS.filter(p => p.store === id)
}

export function findSizeById(sizeId: string): { platform: PlatformSpec; size: OutputSize } | undefined {
  for (const platform of PLATFORMS) {
    const s = platform.sizes.find(x => x.id === sizeId)
    if (s) return { platform, size: s }
  }
  return undefined
}

export interface ResolvedSize {
  width: number
  height: number
  label: string
}

/** Output pixel size for a deck, honoring custom sizes and orientation. */
export function resolveDeckSize(deck: { platformId: string; sizeId: string; customSize: { width: number; height: number }; orientation: Orientation }): ResolvedSize {
  if (deck.sizeId === 'custom') {
    return { width: deck.customSize.width, height: deck.customSize.height, label: 'Custom' }
  }
  const platform = getPlatform(deck.platformId)
  const s = platform?.sizes.find(x => x.id === deck.sizeId) ?? platform?.sizes[0]
  if (!platform || !s) return { width: 1320, height: 2868, label: 'Fallback' }
  const natural = s.width > s.height ? 'landscape' : s.width < s.height ? 'portrait' : 'square'
  const swap = platform.rotatable && natural !== 'square' && natural !== deck.orientation
  return swap ? { width: s.height, height: s.width, label: s.label } : { width: s.width, height: s.height, label: s.label }
}

/** Validates a custom size against the platform rules; returns human-readable problems. */
export function validateSize(platformId: string, width: number, height: number): string[] {
  const problems: string[] = []
  const platform = getPlatform(platformId)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > 8000 || height > 8000) {
    problems.push('Width and height must be whole numbers between 100 and 8000.')
  }
  const rules = platform?.rules
  if (!rules) return problems
  const short = Math.min(width, height)
  const long = Math.max(width, height)
  if (rules.minSide && short < rules.minSide) problems.push(`Shortest side must be at least ${rules.minSide}px.`)
  if (rules.maxSide && long > rules.maxSide) problems.push(`Longest side must be at most ${rules.maxSide}px.`)
  if (rules.maxAspect && long / short > rules.maxAspect) problems.push(`Long side can be at most ${rules.maxAspect}× the short side.`)
  if (rules.aspects && !rules.aspects.some(([a, b]) => Math.abs(width / height - a / b) < 0.01)) {
    problems.push(`Aspect ratio must be one of ${rules.aspects.map(([a, b]) => `${a}:${b}`).join(', ')}.`)
  }
  return problems
}

/** Legacy (v1) outputDevice ids → platform/size, used when importing old projects. */
export const LEGACY_OUTPUT_MAP: Record<string, { platformId: string; sizeId: string }> = {
  'iphone-6.9': { platformId: 'app-store-iphone', sizeId: 'iphone-6.9' },
  'iphone-6.7': { platformId: 'app-store-iphone', sizeId: 'iphone-6.9-1290' },
  'iphone-6.5': { platformId: 'app-store-iphone', sizeId: 'iphone-6.5' },
  'iphone-5.5': { platformId: 'app-store-iphone', sizeId: 'iphone-5.5' },
  'ipad-12.9': { platformId: 'app-store-ipad', sizeId: 'ipad-12.9' },
  'ipad-11': { platformId: 'app-store-ipad', sizeId: 'ipad-11' },
  'android-phone': { platformId: 'google-play-phone', sizeId: 'android-phone' },
  'android-phone-hd': { platformId: 'google-play-phone', sizeId: 'android-phone-hd' },
  'android-tablet-7': { platformId: 'google-play-tablet-7', sizeId: 'android-tablet-7' },
  'android-tablet-10': { platformId: 'google-play-tablet-10', sizeId: 'android-tablet-10' },
  'web-og': { platformId: 'web-social', sizeId: 'web-og' },
  'web-twitter': { platformId: 'web-social', sizeId: 'web-twitter' },
  'web-hero': { platformId: 'web-social', sizeId: 'web-hero' },
  'web-feature': { platformId: 'google-play-artwork', sizeId: 'feature-graphic' },
}
