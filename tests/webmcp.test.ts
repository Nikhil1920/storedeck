import { beforeEach, describe, expect, it, vi } from 'vitest'
import { freshEditor, PNG } from './helpers'

// Rendering needs a real canvas; tools are tested against a fake renderer that
// records what it was asked to draw.
const renders: Array<{ screenId: string; lang: string; maxDimension?: number }> = []
vi.mock('../src/lib/render/service', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/lib/render/service')>()
  const fakeCanvas = (w: number, h: number) => ({ width: w, height: h, toDataURL: () => `data:image/png;base64,${btoa(`${w}x${h}`)}`, getContext: () => null }) as unknown as HTMLCanvasElement
  return {
    ...actual,
    renderScreenImage: async (screen: { id: string }, deck: Parameters<typeof actual.planExport>[0]['variants'][0]['decks'][0], _p: unknown, lang: string, opts: { maxDimension?: number } = {}) => {
      renders.push({ screenId: screen.id, lang, maxDimension: opts.maxDimension })
      const { resolveDeckSize } = await import('../src/lib/model/platforms')
      const size = resolveDeckSize(deck)
      const k = opts.maxDimension ? Math.min(1, opts.maxDimension / Math.max(size.width, size.height)) : 1
      return { canvas: fakeCanvas(Math.round(size.width * k), Math.round(size.height * k)), width: Math.round(size.width * k), height: Math.round(size.height * k), outputWidth: size.width, outputHeight: size.height }
    },
    canvasToBlob: async () => new Blob(['png'], { type: 'image/png' }),
    canvasToDataUrl: (c: HTMLCanvasElement, format = 'png') => `data:image/${format};base64,${btoa(`${c.width}x${c.height}`)}`,
  }
})

async function setup() {
  const E = await freshEditor()
  const { buildTools } = await import('../src/lib/webmcp/tools')
  const tools = new Map(buildTools().map(t => [t.name, t]))
  const call = (name: string, input: unknown = {}) => {
    const tool = tools.get(name)
    if (!tool) throw new Error(`no tool ${name}`)
    return tool.execute(input) as Promise<Record<string, any>> // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return { ...E, tools, call }
}

describe('WebMCP tools', () => {
  let T: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    renders.length = 0
    T = await setup()
  })

  it('exposes one tool per spec with schemas and annotations', async () => {
    const { TOOL_SPECS } = await import('../src/lib/webmcp/specs')
    expect(T.tools.size).toBe(TOOL_SPECS.length)
    for (const t of T.tools.values()) {
      expect(t.description.length).toBeGreaterThan(40)
      expect(t.inputSchema.type).toBe('object')
      expect(t.inputSchema.additionalProperties).toBe(false)
    }
    expect(T.tools.get('get_app_state')!.annotations.readOnlyHint).toBe(true)
  })

  it('validates inputs with actionable errors', async () => {
    await expect(T.call('manage_screens', { action: 'explode' })).rejects.toThrow(/action must be one of/)
    await expect(T.call('set_background', { solid: 'red' })).rejects.toThrow(/solid has an invalid format/)
    await expect(T.call('set_copy', { entries: [{ field: 'headline', language: 'en' }] })).rejects.toThrow(/text is required/)
    await expect(T.call('get_app_state', { bogus: 1 })).rejects.toThrow(/bogus is not a known property/)
    await expect(T.call('manage_project', { action: 'delete', projectId: 'x' })).rejects.toThrow(/confirm: true/)
  })

  it('runs a full autonomous workflow: upload → copy → design → variant → platform → export', async () => {
    const up = await T.call('manage_screens', {
      action: 'upload',
      screenshots: [
        { filename: 'home.png', dataUrl: PNG },
        { filename: 'search.png', dataUrl: PNG },
        { filename: 'home_te.png', dataUrl: PNG },
      ],
    })
    expect(up.results.map((r: { action: string }) => r.action)).toEqual(['created-screen', 'created-screen', 'added-localized-image'])

    const copy = await T.call('set_copy', {
      entries: [
        { screenIndex: 0, field: 'headline', language: 'en', text: 'Just speak' },
        { screenIndex: 0, field: 'headline', language: 'te', text: 'మాట్లాడండి' },
        { screenIndex: 1, field: 'subheadline', language: 'en', text: 'Find anything fast' },
        { screenIndex: 9, field: 'headline', language: 'en', text: 'nope' },
      ],
    })
    expect(copy.applied).toBe(3)
    expect(copy.errors[0]).toMatch(/out of range/)

    await T.call('set_background', { scope: 'platform', gradientPreset: 'Morning Mist' })
    await T.call('set_text_style', { scope: 'platform', headline: { color: '#111111', weight: '800' }, align: 'left' })
    const dev = await T.call('set_device', { screenIndex: 1, preset: 'tilt-left', chrome: { style: 'phone', color: '#222222' } })
    expect(dev.device.rotation).toBe(-8)

    const state = await T.call('get_app_state')
    const deck = state.variants[0].decks[0]
    expect(deck.screens[0].headline).toEqual({ en: 'Just speak', te: 'మాట్లాడండి' })
    expect(state.project.languages.map((l: { code: string }) => l.code)).toEqual(['en', 'te'])
    expect(state.selection.screenId).toBe(deck.screens[1].id) // focused by the single-target edit

    const variant = await T.call('manage_variant', { action: 'create', name: 'Outcome copy', hypothesis: 'Outcomes beat features' })
    expect(variant.decks[0].screens).toHaveLength(2)
    await T.call('set_copy', { entries: [{ screenIndex: 0, field: 'headline', language: 'en', text: 'Talk. It types.' }] })
    const after = await T.call('get_app_state')
    expect(after.variants[0].decks[0].screens[0].headline.en).toBe('Just speak')
    expect(after.variants[1].decks[0].screens[0].headline.en).toBe('Talk. It types.')

    const tv = await T.call('manage_platform', { action: 'add', platformId: 'google-play-tv', cloneFromDeckId: variant.decks[0].id })
    expect(tv.decks[0]).toMatchObject({ width: 1920, height: 1080, screenCount: 2 })

    const exp = await T.call('export', { allLanguages: true })
    expect(exp.count).toBe(4)
    expect(exp.files.map((f: { path: string }) => f.path)).toEqual([
      'android-tv-google-tv-1920x1080/en/01-home.png',
      'android-tv-google-tv-1920x1080/te/01-home.png',
      'android-tv-google-tv-1920x1080/en/02-search.png',
      'android-tv-google-tv-1920x1080/te/02-search.png',
    ])
    // Exporting several variants adds a variant folder.
    const both = await T.call('export', { variantIds: after.variants.map((v: { id: string }) => v.id), allPlatforms: true, languages: ['en'] })
    expect(both.files.map((f: { path: string }) => f.path)).toContain('outcome-copy/iphone-1320x2868/en/01-home.png')
    expect(both.files.map((f: { path: string }) => f.path)).toContain('original/iphone-1320x2868/en/01-home.png')
    expect(exp.files[0].dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('returns bounded rendered previews for a scope', async () => {
    await T.call('manage_screens', { action: 'upload', screenshots: [{ filename: 'a.png', dataUrl: PNG }, { filename: 'b.png', dataUrl: PNG }] })
    const r = await T.call('get_images', { scope: 'platform', maxDimension: 600 })
    expect(r.count).toBe(2)
    expect(r.images[0]).toMatchObject({ height: 600, outputWidth: 1320, outputHeight: 2868 })
    expect(renders.every(x => x.maxDimension === 600 && x.lang === 'en')).toBe(true)
    await expect(T.call('get_images', { language: 'fr' })).rejects.toThrow(/not in the project/)
  })

  it('manages elements and popouts with per-kind property checks', async () => {
    await T.call('manage_screens', { action: 'upload', screenshots: [{ filename: 'a.png', dataUrl: PNG }] })
    const el = await T.call('manage_elements', { action: 'add', kind: 'text', text: 'Editor’s choice', properties: { frame: 'pill', frameColor: '#ffcc00', y: 90 } })
    await expect(T.call('manage_elements', { action: 'update', elementId: el.elementId, properties: { strokeWidth: 2 } })).rejects.toThrow(/not applicable to text/)
    await T.call('manage_elements', { action: 'update', elementId: el.elementId, text: 'Auswahl der Redaktion', language: 'de' })
    const strings = await T.call('get_strings')
    const row = strings.rows.find((r: { field: string }) => r.field === `element:${el.elementId}`)
    expect(row.values).toMatchObject({ en: 'Editor’s choice', de: 'Auswahl der Redaktion' })
    const pop = await T.call('manage_popouts', { action: 'add', properties: { cropX: 90, cropWidth: 50 } })
    const screen = await T.call('get_screen')
    const p = screen.screen.popouts.find((x: { id: string }) => x.id === pop.popoutId)
    expect(p.cropX + p.cropWidth).toBeLessThanOrEqual(100)
  })

  it('supports undo/redo, view control and language management', async () => {
    await T.call('manage_screens', { action: 'upload', screenshots: [{ filename: 'a.png', dataUrl: PNG }] })
    await T.call('set_device', { scale: 50 })
    await T.call('history', { action: 'undo' })
    expect((await T.call('get_screen')).screen.device.scale).toBe(70)
    await T.call('history', { action: 'redo' })
    expect((await T.call('get_screen')).screen.device.scale).toBe(50)
    const v = await T.call('set_view', { view: 'strings', inspectorTab: 'text' })
    expect(v.view).toMatchObject({ view: 'strings', inspectorTab: 'text' })
    await T.call('manage_languages', { action: 'add', languages: ['ar', 'ja'] })
    await T.call('manage_languages', { action: 'switch', language: 'ar' })
    const s = await T.call('get_app_state')
    expect(s.selection.language).toBe('ar')
    await expect(T.call('manage_languages', { action: 'switch', language: 'ko' })).rejects.toThrow(/not in this project/)
  })

  it('transfers style across platforms while keeping copy and images', async () => {
    await T.call('manage_screens', { action: 'upload', screenshots: [{ filename: 'a.png', dataUrl: PNG }, { filename: 'b.png', dataUrl: PNG }] })
    await T.call('set_copy', { entries: [{ screenIndex: 1, field: 'headline', language: 'en', text: 'Keep me' }] })
    await T.call('set_background', { screenIndex: 0, solid: '#123456', type: 'solid' })
    const r = await T.call('transfer_style', { sourceScreenIndex: 0, targetScope: 'platform', parts: { background: true, device: false, text: false, elements: false } })
    expect(r.updated).toBe(1)
    const s = await T.call('get_screen', { screenIndex: 1 })
    expect(s.screen.background.solid).toBe('#123456')
    expect(s.screen.copy.headline.en).toBe('Keep me')
  })
})
