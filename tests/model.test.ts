import { describe, expect, it } from 'vitest'
import { newDeck, newScreen } from '../src/lib/model/defaults'
import { baseFilename, detectLanguageFromFilename } from '../src/lib/model/languages'
import { convertLegacyProject } from '../src/lib/model/legacy'
import { adaptScreen, applyTextPatch, effectiveLayout, fallbackChain, resolveLocalized } from '../src/lib/model/ops'
import { PLATFORMS, resolveDeckSize, validateSize } from '../src/lib/model/platforms'
import { cssGradientLine, wrapText } from '../src/lib/render/canvas'
import { validate } from '../src/lib/webmcp/schema'
import { TOOL_SPECS } from '../src/lib/webmcp/specs'

describe('platform catalog', () => {
  it('has unique ids and valid defaults', () => {
    const ids = PLATFORMS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const sizeIds = PLATFORMS.flatMap(p => p.sizes.map(s => s.id))
    expect(new Set(sizeIds).size).toBe(sizeIds.length)
    for (const p of PLATFORMS) expect(p.sizes.some(s => s.id === p.defaultSizeId)).toBe(true)
  })

  it('every catalog size passes its own platform rules', () => {
    for (const p of PLATFORMS) for (const s of p.sizes) expect(validateSize(p.id, s.width, s.height), `${p.id}/${s.id}`).toEqual([])
  })

  it('Google Play large-screen sizes are 9:16 within the Play Console ranges', () => {
    for (const [id, min, max] of [['google-play-tablet-7', 320, 3840], ['google-play-tablet-10', 1080, 7680]] as const) {
      const p = PLATFORMS.find(x => x.id === id)!
      for (const s of p.sizes) {
        expect(s.width * 16).toBe(s.height * 9)
        expect(Math.min(s.width, s.height)).toBeGreaterThanOrEqual(min)
        expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(max)
      }
    }
    expect(validateSize('google-play-phone', 1000, 2200)).toEqual(['Long side can be at most 2× the short side.'])
  })

  it('swaps sizes for landscape decks only on rotatable platforms', () => {
    const iphone = newDeck('app-store-iphone')
    expect(resolveDeckSize({ ...iphone, orientation: 'landscape' })).toMatchObject({ width: 2868, height: 1320 })
    const tv = newDeck('app-store-apple-tv')
    expect(resolveDeckSize({ ...tv, orientation: 'portrait' })).toMatchObject({ width: 3840, height: 2160 })
  })
})

describe('localization helpers', () => {
  it('detects language suffixes and base names', () => {
    expect(detectLanguageFromFilename('home_de.png')).toBe('de')
    expect(detectLanguageFromFilename('home-pt-br.png')).toBe('pt-br')
    expect(detectLanguageFromFilename('home_pt_BR.png')).toBe('pt-br')
    expect(detectLanguageFromFilename('home.png')).toBeNull()
    expect(baseFilename('01-dictate_te.png')).toBe('01-dictate')
    expect(baseFilename('01-dictate.png')).toBe('01-dictate')
  })

  it('falls back through default and project languages', () => {
    const chain = fallbackChain({ languages: ['en', 'de', 'fr'], defaultLanguage: 'en' }, 'fr')
    expect(chain).toEqual(['fr', 'en', 'de'])
    expect(resolveLocalized({ en: 'Hello', fr: '' }, chain)).toBe('Hello')
  })

  it('stores per-language layout overrides without touching the base style', () => {
    const s = newScreen('x')
    applyTextPatch(s.text, { headline: { size: 80, color: '#000000' }, offsetY: 10 }, 'de')
    expect(s.text.headline.size).not.toBe(80)
    expect(s.text.headline.color).toBe('#000000')
    expect(effectiveLayout(s.text, 'de')).toMatchObject({ headlineSize: 80, offsetY: 10 })
    expect(effectiveLayout(s.text, 'en').headlineSize).toBe(s.text.headline.size)
  })

  it('rescales type when adapting a phone screen to TV', () => {
    const s = newScreen('x', newDeck('app-store-iphone'))
    s.images.en = { assetId: 'a', name: 'a.png', width: 1320, height: 2868 }
    const before = s.text.headline.size
    adaptScreen(s, { width: 1320, height: 2868 }, { width: 1920, height: 1080 }, 'app-store-apple-tv')
    expect(s.text.headline.size).toBeLessThan(before)
    expect(s.device.chrome.style).toBe('phone') // portrait capture keeps a phone frame
  })
})

describe('rendering helpers', () => {
  const ctx = { measureText: (t: string) => ({ width: t.length * 10 }) } as unknown as CanvasRenderingContext2D

  it('wraps words, keeps manual breaks and splits overlong tokens', () => {
    expect(wrapText(ctx, 'Just speak and it types', 100)).toEqual(['Just speak', 'and it', 'types'])
    expect(wrapText(ctx, 'One\nTwo', 100)).toEqual(['One', 'Two'])
    expect(wrapText(ctx, 'Donaudampfschifffahrt', 100)).toEqual(['Donaudampf', 'schifffahr', 't'])
  })

  it('matches CSS gradient angles', () => {
    const up = cssGradientLine(0, 100, 200)
    expect(up).toMatchObject({ x0: 50, x1: 50, y0: 200, y1: 0 })
    const right = cssGradientLine(90, 100, 200)
    expect(right.x0).toBeCloseTo(0)
    expect(right.x1).toBeCloseTo(100)
  })
})

describe('schema validation', () => {
  it('accepts every documented example shape and rejects unknown keys', () => {
    const spec = TOOL_SPECS.find(t => t.name === 'set_device')!
    expect(() => validate(spec.inputSchema, { scope: 'platform', preset: 'centered', shadow: { blur: 30 } })).not.toThrow()
    expect(() => validate(spec.inputSchema, { shadow: { spread: 3 } })).toThrow(/spread is not a known property/)
    expect(() => validate(spec.inputSchema, { scale: 500 })).toThrow(/≤ 150/)
  })
})

describe('legacy import', () => {
  it('converts a v1 project with localized images, text and elements', async () => {
    const put = async (_url: string, name: string) => ({ assetId: `a_${name}`, name, width: 1290, height: 2796 })
    const project = await convertLegacyProject(
      {
        outputDevice: 'android-phone',
        projectLanguages: ['en', 'de'],
        currentLanguage: 'de',
        selectedIndex: 0,
        screenshots: [
          {
            name: 'home.png',
            localizedImages: { en: { src: 'data:image/png;base64,AA', name: 'home.png' }, de: { src: 'data:image/png;base64,AA', name: 'home_de.png' } },
            background: { type: 'gradient', gradient: { angle: 45, stops: [{ color: '#000000', position: 0 }, { color: '#ffffff', position: 100 }] } },
            screenshot: { scale: 80, x: 50, y: 60, use3D: true, device3D: 'samsung', frame: { enabled: true, color: '#ff0000', width: 8, opacity: 90 } },
            text: { headlines: { en: 'Hi', de: 'Hallo' }, subheadlineEnabled: true, subheadlines: { en: 'Sub' }, headlineColor: '#123456', position: 'bottom' },
            elements: [{ type: 'text', texts: { en: 'New' }, x: 10, y: 20, width: 30, layer: 'behind-screenshot' }, { type: 'emoji', emoji: '⭐', x: 1, y: 2 }],
          },
        ],
      },
      'Legacy app',
      put,
    )
    const deck = project.variants[0].decks[0]
    expect(deck.platformId).toBe('google-play-phone')
    expect(project.lastSelection.language).toBe('de')
    const s = deck.screens[0]
    expect(Object.keys(s.images)).toEqual(['en', 'de'])
    expect(s.background.gradient.angle).toBe(135)
    expect(s.device).toMatchObject({ scale: 80, use3D: true, model3D: 'samsung' })
    expect(s.device.border).toMatchObject({ enabled: true, color: '#ff0000' })
    expect(s.copy.headline).toEqual({ en: 'Hi', de: 'Hallo' })
    expect(s.text.position).toBe('bottom')
    expect(s.elements.map(e => e.kind)).toEqual(['text', 'emoji'])
    expect(s.elements[0].layer).toBe('behind-device')
  })
})
