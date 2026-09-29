// Font handling. A font value is either a CSS family list
// ("-apple-system, 'SF Pro Display'") or a bare Google Fonts family ("Inter").

import { announceResourceReady } from '../storage/assets'

export const SYSTEM_FONTS: Array<{ name: string; value: string }> = [
  { name: 'System (SF Pro)', value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif" },
  { name: 'SF Pro Rounded', value: "'SF Pro Rounded', ui-rounded, -apple-system, sans-serif" },
  { name: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { name: 'Avenir Next', value: "'Avenir Next', Avenir, sans-serif" },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Times New Roman', value: "'Times New Roman', serif" },
  { name: 'Courier New', value: "'Courier New', monospace" },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
]

export const POPULAR_GOOGLE_FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Plus Jakarta Sans', 'DM Sans', 'Manrope', 'Outfit', 'Sora', 'Space Grotesk', 'Figtree',
  'Urbanist', 'Lexend', 'Nunito', 'Rubik', 'Work Sans', 'Raleway', 'Roboto', 'Open Sans', 'Lato', 'Albert Sans',
  'Red Hat Display', 'Archivo', 'Barlow', 'Kanit', 'Prompt', 'Mulish', 'Quicksand', 'Josefin Sans', 'Bebas Neue', 'Anton',
  'Oswald', 'Archivo Black', 'Dela Gothic One', 'Playfair Display', 'DM Serif Display', 'Merriweather', 'Lora', 'Fraunces',
  'Cormorant Garamond', 'EB Garamond', 'Libre Baskerville', 'Bitter', 'Roboto Slab', 'Zilla Slab', 'JetBrains Mono',
  'IBM Plex Sans', 'IBM Plex Mono', 'Fira Sans', 'Source Sans 3', 'Noto Sans', 'Noto Serif', 'Noto Sans JP', 'Noto Sans KR',
  'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'Noto Sans Devanagari', 'Noto Sans Telugu',
  'Noto Sans Tamil', 'Noto Sans Bengali', 'Noto Sans Thai', 'Cairo', 'Tajawal', 'Heebo', 'Hind', 'Mukta', 'Baloo 2',
  'Pacifico', 'Caveat', 'Dancing Script', 'Permanent Marker', 'Righteous', 'Comfortaa', 'Varela Round', 'Fredoka',
  'Chakra Petch', 'Orbitron', 'Exo 2', 'Titillium Web', 'Rajdhani', 'Teko', 'Saira', 'Unbounded', 'Syne', 'Bricolage Grotesque',
  'Instrument Sans', 'Instrument Serif', 'Onest', 'Geist', 'Geist Mono',
]

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-rounded', 'ui-sans-serif', 'ui-serif', '-apple-system', 'blinkmacsystemfont'])
const LOCAL_FAMILIES = new Set(
  ['SF Pro Display', 'SF Pro Rounded', 'SF Pro Text', 'Helvetica Neue', 'Helvetica', 'Arial', 'Avenir Next', 'Avenir', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'].map(f => f.toLowerCase()),
)

/** Primary family of a font value, without quotes. */
export function primaryFamily(font: string): string {
  const first = font.split(',')[0]?.trim() ?? ''
  return first.replace(/^['"]|['"]$/g, '')
}

/** CSS font-family list usable in canvas `font` strings. */
export function cssFamily(font: string): string {
  if (font.includes(',') || /^['"]/.test(font.trim())) return font
  return `"${font.trim()}", ${SYSTEM_FONTS[0].value}`
}

/** Families that must be fetched from Google Fonts for this value. */
export function googleFamilyOf(font: string): string | null {
  const family = primaryFamily(font)
  if (!family || GENERIC.has(family.toLowerCase()) || LOCAL_FAMILIES.has(family.toLowerCase())) return null
  return family
}

const loaded = new Map<string, Promise<void>>()

function injectStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => {
      link.remove()
      reject(new Error(`Failed to load ${href}`))
    }
    document.head.appendChild(link)
  })
}

/** Loads a Google font family (all common weights, with graceful fallback). */
export function loadGoogleFont(family: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  let p = loaded.get(family)
  if (!p) {
    const enc = encodeURIComponent(family).replace(/%20/g, '+')
    p = injectStylesheet(`https://fonts.googleapis.com/css2?family=${enc}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`)
      .catch(() => injectStylesheet(`https://fonts.googleapis.com/css2?family=${enc}:wght@400;700&display=swap`))
      .catch(() => injectStylesheet(`https://fonts.googleapis.com/css2?family=${enc}&display=swap`))
      .then(async () => {
        await Promise.all(['400', '700'].map(w => document.fonts.load(`${w} 32px "${family}"`).catch(() => [])))
        announceResourceReady()
      })
      .catch(err => {
        console.warn(`[fonts] ${family}:`, err)
      })
    loaded.set(family, p)
  }
  return p
}

/** Ensures every font value's family and weights are available before rendering. */
export async function ensureFonts(specs: Array<{ font: string; weight?: string; italic?: boolean }>): Promise<void> {
  if (typeof document === 'undefined') return
  const google = new Set(specs.map(s => googleFamilyOf(s.font)).filter((f): f is string => !!f))
  await Promise.all([...google].map(loadGoogleFont))
  await Promise.all(
    specs.map(s => document.fonts.load(`${s.italic ? 'italic ' : ''}${s.weight ?? '400'} 32px ${cssFamily(s.font)}`).catch(() => [])),
  )
  await document.fonts.ready
}

let fontListener = false
/** Re-render when any web font finishes loading. */
export function watchFontLoading(): void {
  if (fontListener || typeof document === 'undefined') return
  fontListener = true
  document.fonts.addEventListener('loadingdone', () => announceResourceReady())
}

let fullList: string[] | null = null
/** Full Google Fonts family list (loaded on demand, falls back to the popular list). */
export async function fetchGoogleFontList(): Promise<string[]> {
  if (fullList) return fullList
  try {
    const res = await fetch('https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity')
    if (res.ok) {
      const data = (await res.json()) as { items?: Array<{ family: string }> }
      if (data.items?.length) return (fullList = data.items.map(i => i.family))
    }
  } catch {
    /* offline or rate-limited — fall back below */
  }
  return (fullList = POPULAR_GOOGLE_FONTS)
}
