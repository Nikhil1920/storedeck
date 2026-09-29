// Rendering entry points shared by the editor canvas, exports and WebMCP.

import { fallbackChain } from '../model/ops'
import { getPlatform, resolveDeckSize } from '../model/platforms'
import type { PlatformDeck, Project, Screen } from '../model/types'
import { announceResourceReady, ensureImages, getImage } from '../storage/assets'
import { renderScreen, screenAssetIds, screenFontSpecs, type RenderEnv, type RenderResult, type Size } from './canvas'
import { ensureFonts } from './fonts'
import { ensureIcon, getIconImage, getLaurel } from './icons'

type ThreeModule = typeof import('./three')
let three: ThreeModule | null = null
let threeLoading: Promise<ThreeModule> | null = null

function loadThree(): Promise<ThreeModule> {
  if (!threeLoading) {
    threeLoading = import('./three').then(m => {
      three = m
      announceResourceReady()
      return m
    })
  }
  return threeLoading
}

export function renderEnv(project: Pick<Project, 'languages' | 'defaultLanguage'>, lang: string): RenderEnv {
  return {
    chain: fallbackChain(project, lang),
    getImage: id => getImage(id),
    getIcon: el => getIconImage(el),
    getLaurel: v => getLaurel(v),
    render3D: args => {
      if (!three) {
        void loadThree()
        return false
      }
      return three.render3D(args)
    },
  }
}

/** Renders into a visible canvas at `scale` (canvas pixels per output pixel). */
export function drawScreen(canvas: HTMLCanvasElement, screen: Screen, size: Size, scale: number, project: Pick<Project, 'languages' | 'defaultLanguage'>, lang: string): RenderResult {
  const w = Math.max(1, Math.round(size.width * scale))
  const h = Math.max(1, Math.round(size.height * scale))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { missing: [] }
  return renderScreen(ctx, screen, size, scale, renderEnv(project, lang))
}

function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(() => reject(new Error('Timed out waiting for fonts, images or 3D models to load')), ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    p.then(
      v => {
        clearTimeout(t)
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      },
      e => {
        clearTimeout(t)
        signal?.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

/** Waits until every resource the screen needs is decoded, so exports are complete. */
export async function prepareScreen(screen: Screen, project: Project, lang: string, signal?: AbortSignal): Promise<void> {
  const chain = fallbackChain(project, lang)
  const work = (async () => {
    await ensureImages(screenAssetIds(screen, chain))
    await ensureFonts(screenFontSpecs(screen))
    await Promise.all(screen.elements.map(el => (el.kind === 'icon' ? ensureIcon(el).catch(() => undefined) : undefined)))
    if (screen.elements.some(el => el.kind === 'text' && el.frame.startsWith('laurel-'))) {
      getLaurel('laurel-simple-left')
      getLaurel('laurel-detailed-left')
      await new Promise(r => setTimeout(r, 50))
    }
    if (screen.device.use3D) {
      const m = await loadThree()
      await m.prepare3D(screen)
    }
  })()
  await withTimeout(work, 20000, signal)
}

export interface RenderedImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
  outputWidth: number
  outputHeight: number
}

/** Full-resolution render, optionally downsampled so the longest side ≤ maxDimension. */
export async function renderScreenImage(screen: Screen, deck: PlatformDeck, project: Project, lang: string, opts: { maxDimension?: number; signal?: AbortSignal } = {}): Promise<RenderedImage> {
  await prepareScreen(screen, project, lang, opts.signal)
  const size = resolveDeckSize(deck)
  const canvas = document.createElement('canvas')
  let result = drawScreen(canvas, screen, size, 1, project, lang)
  if (result.missing.length) {
    // Resources announced late (e.g. 3D module just loaded): one more pass.
    await new Promise(r => setTimeout(r, 30))
    result = drawScreen(canvas, screen, size, 1, project, lang)
  }
  if (result.missing.length) throw new Error(`Could not render — missing ${result.missing.join(', ')}`)
  let out = canvas
  if (opts.maxDimension && Math.max(size.width, size.height) > opts.maxDimension) {
    const k = opts.maxDimension / Math.max(size.width, size.height)
    out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(size.width * k))
    out.height = Math.max(1, Math.round(size.height * k))
    const ctx = out.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, out.width, out.height)
  }
  return { canvas: out, width: out.width, height: out.height, outputWidth: size.width, outputHeight: size.height }
}

export type ImageFormat = 'png' | 'jpeg'

export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat = 'png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (format === 'jpeg') {
      // Stores reject alpha channels; flatten onto white for JPEG.
      const flat = document.createElement('canvas')
      flat.width = canvas.width
      flat.height = canvas.height
      const ctx = flat.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, flat.width, flat.height)
      ctx.drawImage(canvas, 0, 0)
      canvas = flat
    }
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas export failed'))), format === 'jpeg' ? 'image/jpeg' : 'image/png', quality)
  })
}

/** Data URL for agents; JPEG is flattened onto white because stores reject alpha. */
export function canvasToDataUrl(canvas: HTMLCanvasElement, format: ImageFormat = 'png', quality = 0.85): string {
  if (format === 'png') return canvas.toDataURL('image/png')
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  return flat.toDataURL('image/jpeg', quality)
}

export function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
}

export interface ExportScope {
  variantIds?: string[]
  deckIds?: string[]
  screenIds?: string[]
  languages?: string[]
  format?: ImageFormat
}

export interface ExportEntry {
  path: string
  variantId: string
  deckId: string
  screenId: string
  language: string
}

/** Enumerates files for an export: variant/platform-size/language/NN-screen.png */
export function planExport(project: Project, scope: ExportScope = {}): Array<ExportEntry & { screen: Screen; deck: PlatformDeck }> {
  const out: Array<ExportEntry & { screen: Screen; deck: PlatformDeck }> = []
  const langs = scope.languages?.length ? scope.languages : project.languages
  const ext = scope.format === 'jpeg' ? 'jpg' : 'png'
  const multiVariant = (scope.variantIds?.length ?? project.variants.length) > 1
  for (const variant of project.variants) {
    if (scope.variantIds?.length && !scope.variantIds.includes(variant.id)) continue
    for (const deck of variant.decks) {
      if (scope.deckIds?.length && !scope.deckIds.includes(deck.id)) continue
      const platform = getPlatform(deck.platformId)
      const size = resolveDeckSize(deck)
      const deckDir = `${slug(platform?.name ?? deck.platformId)}-${size.width}x${size.height}`
      deck.screens.forEach((screen, i) => {
        if (scope.screenIds?.length && !scope.screenIds.includes(screen.id)) return
        for (const lang of langs) {
          const parts = [multiVariant ? slug(variant.name) : null, deckDir, lang, `${String(i + 1).padStart(2, '0')}-${slug(screen.name)}.${ext}`].filter(Boolean)
          out.push({ path: parts.join('/'), variantId: variant.id, deckId: deck.id, screenId: screen.id, language: lang, screen, deck })
        }
      })
    }
  }
  return out
}

export async function exportZip(project: Project, scope: ExportScope, onProgress?: (done: number, total: number, path: string) => void, signal?: AbortSignal): Promise<{ blob: Blob; files: number }> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const plan = planExport(project, scope)
  if (!plan.length) throw new Error('Nothing to export — the selection has no screens')
  let done = 0
  for (const item of plan) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    onProgress?.(done, plan.length, item.path)
    const img = await renderScreenImage(item.screen, item.deck, project, item.language, { signal })
    zip.file(item.path, await canvasToBlob(img.canvas, scope.format ?? 'png'))
    done++
  }
  onProgress?.(done, plan.length, '')
  return { blob: await zip.generateAsync({ type: 'blob' }), files: plan.length }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
