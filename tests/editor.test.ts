import { beforeEach, describe, expect, it } from 'vitest'
import { freshEditor, PNG } from './helpers'

describe('editor store & actions', () => {
  let E: Awaited<ReturnType<typeof freshEditor>>
  beforeEach(async () => {
    E = await freshEditor()
  })

  it('boots with a default project, variant and iPhone deck', () => {
    const s = E.store.getState()
    expect(s.ready).toBe(true)
    expect(s.project?.variants).toHaveLength(1)
    expect(s.project?.variants[0].decks[0].platformId).toBe('app-store-iphone')
    expect(s.sel.variantId).toBe(s.project?.variants[0].id)
  })

  it('uploads screenshots, groups localized files and detects languages', async () => {
    const res = await E.actions.uploadScreenshots([
      { name: 'home.png', dataUrl: PNG },
      { name: 'search.png', dataUrl: PNG },
      { name: 'home_de.png', dataUrl: PNG },
    ])
    expect(res.map(r => r.action)).toEqual(['created-screen', 'created-screen', 'added-localized-image'])
    const deck = E.store.current().deck!
    expect(deck.screens).toHaveLength(2)
    expect(Object.keys(deck.screens[0].images).sort()).toEqual(['de', 'en'])
    expect(E.store.getState().project!.languages).toContain('de')
  })

  it('undo/redo restores document state and coalesces slider edits', async () => {
    await E.actions.uploadScreenshots([{ name: 'a.png', dataUrl: PNG }])
    const id = E.store.getState().sel.screenId!
    E.actions.setDevice([id], { scale: 50 }, undefined, 'drag')
    E.actions.setDevice([id], { scale: 55 }, undefined, 'drag')
    E.actions.setDevice([id], { scale: 60 }, undefined, 'drag')
    expect(E.store.current().screen!.device.scale).toBe(60)
    E.store.undo()
    expect(E.store.current().screen!.device.scale).toBe(70)
    E.store.redo()
    expect(E.store.current().screen!.device.scale).toBe(60)
  })

  it('clones variants for A/B tests and keeps platform/screen position when switching', async () => {
    await E.actions.uploadScreenshots([{ name: 'a.png', dataUrl: PNG }, { name: 'b.png', dataUrl: PNG }])
    const s0 = E.store.getState()
    E.store.select({ screenId: E.store.current().deck!.screens[1].id })
    const vB = E.actions.addVariant({ name: 'Benefit copy' })
    const c = E.store.current()
    expect(c.variant!.id).toBe(vB)
    expect(c.variant!.decks[0].screens).toHaveLength(2)
    expect(c.screenIndex).toBe(1)
    expect(c.variant!.decks[0].screens[0].id).not.toBe(s0.project!.variants[0].decks[0].screens[0].id)
    E.actions.updateVariant(vB, { status: 'control' })
    const statuses = E.store.getState().project!.variants.map(v => v.status)
    expect(statuses.filter(s => s === 'control')).toHaveLength(1)
  })

  it('adds a platform cloned from another deck and rescales text', async () => {
    await E.actions.uploadScreenshots([{ name: 'a.png', dataUrl: PNG }])
    const iphone = E.store.current().deck!
    const headline = iphone.screens[0].text.headline.size
    const [deckId] = E.actions.addPlatform('app-store-apple-tv', { cloneFromDeckId: iphone.id })
    const tv = E.store.current().deck!
    expect(tv.id).toBe(deckId)
    expect(tv.screens).toHaveLength(1)
    // Portrait phone captures keep a phone frame on a landscape TV canvas.
    expect(tv.screens[0].device.chrome.style).toBe('phone')
    expect(tv.screens[0].text.headline.size).not.toBe(headline)
  })

  it('writes copy with per-language fallbacks and reports missing translations', async () => {
    await E.actions.uploadScreenshots([{ name: 'a.png', dataUrl: PNG }])
    const id = E.store.getState().sel.screenId!
    E.actions.addLanguages(['fr'])
    const r = E.actions.setCopy([{ screenId: id, field: 'headline', language: 'en', text: 'Track everything' }])
    expect(r.applied).toBe(1)
    const ops = await import('../src/lib/model/ops')
    const project = E.store.getState().project!
    const missing = ops.missingTranslations(project, ops.collectStrings(project))
    expect(missing[0].missing).toEqual(['fr'])
  })

  it('persists to IndexedDB', async () => {
    await E.actions.uploadScreenshots([{ name: 'a.png', dataUrl: PNG }])
    await E.store.flushSave()
    const db = await import('../src/lib/storage/db')
    const saved = await db.getProject(E.store.getState().project!.id)
    expect(saved?.variants[0].decks[0].screens).toHaveLength(1)
  })
})
