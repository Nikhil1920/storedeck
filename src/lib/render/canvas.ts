// Canvas compositor. Everything is laid out in output pixels; `scale` maps
// output pixels to canvas pixels so previews render small and exports render
// at full resolution from the same code path.
//
// Layer order: background → noise → elements(behind-device) → device →
// elements(above-device) → popouts → headline/subheadline → elements(above-text)

import { effectiveLayout, resolveLocalized, screenImage } from '../model/ops'
import { isRtl } from '../model/languages'
import type { Background, CanvasElement, ChromeStyle, DeviceSettings, IconElement, Popout, Screen, ShadowSettings, TextElement } from '../model/types'
import { cssFamily } from './fonts'

export interface Drawable {
  width: number
  height: number
}
type Img = CanvasImageSource & Drawable

export interface Render3DArgs {
  ctx: CanvasRenderingContext2D
  screen: Screen
  image: Img | undefined
  width: number
  height: number
  scale: number
}

export interface RenderEnv {
  /** Language fallback chain; the first entry is the language being rendered. */
  chain: string[]
  getImage(assetId: string): Img | undefined
  getIcon(el: IconElement): Img | undefined
  getLaurel(variant: 'laurel-simple-left' | 'laurel-detailed-left'): Img | undefined
  /** Draws the 3D device; returns false if the model is not ready yet. */
  render3D?(args: Render3DArgs): boolean
}

export interface RenderResult {
  /** Resources that were not ready; render again once they load. */
  missing: string[]
}

export interface Size {
  width: number
  height: number
}

export function renderScreen(ctx: CanvasRenderingContext2D, screen: Screen, size: Size, scale: number, env: RenderEnv): RenderResult {
  const missing: string[] = []
  const { width: W, height: H } = size
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  drawBackground(ctx, screen.background, W, H, scale, env, missing)
  if (screen.background.noise) applyNoise(ctx, screen.background.noiseIntensity, hashSeed(screen.id))

  const lang = env.chain[0]
  drawElements(ctx, screen.elements, 'behind-device', W, H, scale, env, missing)
  const imageRef = screenImage(screen, env.chain)
  const image = imageRef ? env.getImage(imageRef.assetId) : undefined
  if (imageRef && !image) missing.push(`image:${imageRef.assetId}`)
  if (screen.device.use3D) {
    if (image && env.render3D) {
      if (!env.render3D({ ctx, screen, image, width: W, height: H, scale })) missing.push(`3d:${screen.device.model3D}`)
    } else if (image) missing.push(`3d:${screen.device.model3D}`)
  } else if (image || screen.device.chrome.style !== 'none') {
    drawDevice(ctx, screen.device, image, W, H, scale)
  }
  drawElements(ctx, screen.elements, 'above-device', W, H, scale, env, missing)
  if (image) drawPopouts(ctx, screen.popouts, image, W, H, scale)
  drawText(ctx, screen, W, H, lang, env.chain)
  drawElements(ctx, screen.elements, 'above-text', W, H, scale, env, missing)
  ctx.restore()
  return { missing }
}

// ---------------------------------------------------------------- helpers

export function hexToRgba(hex: string, alpha: number): string {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '000000'
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Lightens (amt > 0) or darkens (amt < 0) a hex color. */
export function shade(hex: string, amt: number): string {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '000000'
  const n = parseInt(h, 16)
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function applyShadow(ctx: CanvasRenderingContext2D, s: ShadowSettings, scale: number) {
  ctx.shadowColor = hexToRgba(s.color, s.opacity / 100)
  ctx.shadowBlur = s.blur * scale
  ctx.shadowOffsetX = s.x * scale
  ctx.shadowOffsetY = s.y * scale
}

function rr(path: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  const radii = Array.isArray(r) ? r.map(v => Math.max(0, Math.min(v, w / 2, h / 2))) : Math.max(0, Math.min(r, w / 2, h / 2))
  path.roundRect(x, y, w, h, radii)
}

// ---------------------------------------------------------------- background

/** CSS-compatible gradient line: 0deg points up, 90deg points right. */
export function cssGradientLine(angleDeg: number, W: number, H: number) {
  const a = (angleDeg * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const len = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a))
  return { x0: W / 2 - (dx * len) / 2, y0: H / 2 - (dy * len) / 2, x1: W / 2 + (dx * len) / 2, y1: H / 2 + (dy * len) / 2 }
}

function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, W: number, H: number, scale: number, env: RenderEnv, missing: string[]) {
  if (bg.type === 'image') {
    const img = bg.imageAssetId ? env.getImage(bg.imageAssetId) : undefined
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    if (!img) {
      if (bg.imageAssetId) missing.push(`image:${bg.imageAssetId}`)
    } else {
      let sx = 0, sy = 0, sw = img.width, sh = img.height
      let dx = 0, dy = 0, dw = W, dh = H
      const ir = img.width / img.height
      const cr = W / H
      if (bg.imageFit === 'cover') {
        if (ir > cr) { sw = img.height * cr; sx = (img.width - sw) / 2 } else { sh = img.width / cr; sy = (img.height - sh) / 2 }
      } else if (bg.imageFit === 'contain') {
        if (ir > cr) { dh = W / ir; dy = (H - dh) / 2 } else { dw = H * ir; dx = (W - dw) / 2 }
      }
      ctx.save()
      if (bg.imageBlur > 0) {
        // Blur in device pixels and overscan so edges do not fade to black.
        const pad = bg.imageBlur * 2
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.filter = `blur(${bg.imageBlur * scale}px)`
        ctx.drawImage(img, sx, sy, sw, sh, (dx - pad) * scale, (dy - pad) * scale, (dw + pad * 2) * scale, (dh + pad * 2) * scale)
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
      }
      ctx.restore()
    }
  } else if (bg.type === 'solid') {
    ctx.fillStyle = bg.solid
    ctx.fillRect(0, 0, W, H)
  } else {
    let gradient: CanvasGradient
    if (bg.gradient.kind === 'radial') {
      gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2)
    } else {
      const l = cssGradientLine(bg.gradient.angle, W, H)
      gradient = ctx.createLinearGradient(l.x0, l.y0, l.x1, l.y1)
    }
    for (const stop of bg.gradient.stops) gradient.addColorStop(Math.min(1, Math.max(0, stop.position / 100)), stop.color)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, W, H)
  }
  if (bg.overlayOpacity > 0) {
    ctx.fillStyle = hexToRgba(bg.overlayColor, bg.overlayOpacity / 100)
    ctx.fillRect(0, 0, W, H)
  }
}

function applyNoise(ctx: CanvasRenderingContext2D, intensity: number, seed: number) {
  const { width, height } = ctx.canvas
  if (!width || !height) return
  const data = ctx.getImageData(0, 0, width, height)
  const px = data.data
  const amp = (intensity / 100) * 50
  let s = seed || 1
  for (let i = 0; i < px.length; i += 4) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const n = ((s / 4294967296) - 0.5) * amp
    px[i] = px[i] + n
    px[i + 1] = px[i + 1] + n
    px[i + 2] = px[i + 2] + n
  }
  ctx.putImageData(data, 0, 0)
}

// ---------------------------------------------------------------- device

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Screenshot rectangle in output pixels (before rotation/perspective). */
export function deviceRect(aspect: number, W: number, H: number, d: Pick<DeviceSettings, 'scale' | 'x' | 'y'>): Rect {
  const k = d.scale / 100
  let w = W * k
  let h = w * aspect
  if (h > H * k) {
    h = H * k
    w = h / aspect
  }
  const moveX = Math.max(W - w, W * 0.15)
  const moveY = Math.max(H - h, H * 0.15)
  return { x: (W - w) / 2 + (d.x / 100 - 0.5) * moveX, y: (H - h) / 2 + (d.y / 100 - 0.5) * moveY, w, h }
}

/** Outer bounds of the device including its 2D chrome (for layout QA). */
export function chromeBounds(style: ChromeStyle, rect: Rect): Rect {
  const { x, y, w, h } = rect
  const m = Math.min(w, h)
  const grow = (l: number, t: number, r: number, b: number): Rect => ({ x: x - l, y: y - t, w: w + l + r, h: h + t + b })
  switch (style) {
    case 'phone':
      return grow(m * 0.065, m * 0.035, m * 0.065, m * 0.035)
    case 'tablet':
      return grow(m * 0.045, m * 0.045, m * 0.045, m * 0.045)
    case 'watch':
      return grow(m * 0.09, m * 0.09, m * 0.2, m * 0.09)
    case 'laptop':
      return grow(w * 0.1, w * 0.022, w * 0.1, w * 0.063)
    case 'monitor':
      return grow(w * 0.018, w * 0.018, w * 0.018, w * 0.03 + h * 0.165)
    case 'tv':
      return grow(w * 0.01, w * 0.01, w * 0.01, h * 0.06)
    case 'browser':
      return grow(0, w * 0.045, 0, 0)
    case 'window':
      return grow(0, w * 0.032, 0, 0)
    default:
      return rect
  }
}

interface ChromeGeometry {
  outer: Path2D
  screenRadii: number | number[]
  under?: (ctx: CanvasRenderingContext2D) => void
  body: (ctx: CanvasRenderingContext2D) => void
  over?: (ctx: CanvasRenderingContext2D) => void
}

export function chromeGeometry(style: ChromeStyle, color: string, rect: Rect, r: number): ChromeGeometry | null {
  const { x, y, w, h } = rect
  const m = Math.min(w, h)
  const fill = (ctx: CanvasRenderingContext2D, c: string, fn: (p: Path2D) => void) => {
    const p = new Path2D()
    fn(p)
    ctx.fillStyle = c
    ctx.fill(p)
  }
  const edge = (ctx: CanvasRenderingContext2D, b: number, radius: number) => {
    ctx.strokeStyle = shade(color, 0.22)
    ctx.lineWidth = Math.max(1, b * 0.12)
    const p = new Path2D()
    rr(p, x - b + ctx.lineWidth / 2, y - b + ctx.lineWidth / 2, w + 2 * b - ctx.lineWidth, h + 2 * b - ctx.lineWidth, radius)
    ctx.stroke(p)
  }
  switch (style) {
    case 'phone': {
      const b = m * 0.035
      const outer = new Path2D()
      rr(outer, x - b, y - b, w + 2 * b, h + 2 * b, r + b)
      const portrait = h >= w
      return {
        outer,
        screenRadii: r,
        under: ctx => {
          const c = shade(color, -0.15)
          if (portrait) {
            fill(ctx, c, p => rr(p, x + w + b * 0.6, y + h * 0.24, b * 0.7, h * 0.1, b * 0.3))
            for (const [top, len] of [[0.17, 0.04], [0.24, 0.07], [0.33, 0.07]]) fill(ctx, c, p => rr(p, x - b * 1.3, y + h * top, b * 0.7, h * len, b * 0.3))
          } else {
            fill(ctx, c, p => rr(p, x + w * 0.24, y - b * 1.3, w * 0.1, b * 0.7, b * 0.3))
          }
        },
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(outer)
          edge(ctx, b, r + b)
        },
        over: ctx => {
          const iw = m * 0.3
          const ih = m * 0.085
          ctx.fillStyle = '#000000'
          const p = new Path2D()
          if (portrait) rr(p, x + w / 2 - iw / 2, y + m * 0.035, iw, ih, ih / 2)
          else rr(p, x + m * 0.035, y + h / 2 - iw / 2, ih, iw, ih / 2)
          ctx.fill(p)
        },
      }
    }
    case 'tablet': {
      const b = m * 0.045
      const outer = new Path2D()
      rr(outer, x - b, y - b, w + 2 * b, h + 2 * b, r + b)
      return {
        outer,
        screenRadii: r,
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(outer)
          edge(ctx, b, r + b)
          ctx.fillStyle = shade(color, -0.4)
          ctx.beginPath()
          ctx.arc(x + w / 2, y - b / 2, b * 0.13, 0, Math.PI * 2)
          ctx.fill()
        },
      }
    }
    case 'watch': {
      const b = m * 0.09
      const outer = new Path2D()
      rr(outer, x - b, y - b, w + 2 * b, h + 2 * b, r + b)
      return {
        outer,
        screenRadii: r,
        under: ctx => {
          fill(ctx, shade(color, 0.12), p => rr(p, x + w + b * 0.7, y + h * 0.24, b * 0.75, h * 0.2, b * 0.25))
          fill(ctx, shade(color, -0.1), p => rr(p, x + w + b * 0.75, y + h * 0.55, b * 0.45, h * 0.2, b * 0.2))
        },
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(outer)
          edge(ctx, b, r + b)
        },
      }
    }
    case 'laptop': {
      const bs = w * 0.022
      const bb = w * 0.035
      const hb = w * 0.028
      const y0 = y + h + bb
      const lid = new Path2D()
      rr(lid, x - bs, y - bs, w + 2 * bs, h + bs + bb, [bs * 1.4, bs * 1.4, bs * 0.3, bs * 0.3])
      const base = new Path2D()
      base.moveTo(x - w * 0.1, y0)
      base.lineTo(x + w * 1.1, y0)
      base.lineTo(x + w * 1.085, y0 + hb)
      base.lineTo(x - w * 0.085, y0 + hb)
      base.closePath()
      const outer = new Path2D()
      outer.addPath(lid)
      outer.addPath(base)
      return {
        outer,
        screenRadii: Math.min(r, bs * 0.4),
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(lid)
          ctx.fillStyle = shade(color, 0.28)
          ctx.fill(base)
          fill(ctx, shade(color, 0.1), p => rr(p, x + w / 2 - w * 0.08, y0, w * 0.16, hb * 0.35, [0, 0, hb * 0.3, hb * 0.3]))
          ctx.fillStyle = shade(color, -0.4)
          ctx.beginPath()
          ctx.arc(x + w / 2, y - bs / 2, bs * 0.18, 0, Math.PI * 2)
          ctx.fill()
        },
      }
    }
    case 'monitor': {
      const b = w * 0.018
      const bb = w * 0.03
      const lid = new Path2D()
      rr(lid, x - b, y - b, w + 2 * b, h + b + bb, b * 1.2)
      const neckH = h * 0.14
      const outer = new Path2D()
      outer.addPath(lid)
      return {
        outer,
        screenRadii: Math.min(r, b * 0.5),
        under: ctx => {
          fill(ctx, shade(color, 0.2), p => p.rect(x + w / 2 - w * 0.06, y + h + bb * 0.5, w * 0.12, neckH))
          fill(ctx, shade(color, 0.25), p => rr(p, x + w / 2 - w * 0.17, y + h + bb * 0.5 + neckH, w * 0.34, h * 0.025, h * 0.0125))
        },
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(lid)
        },
      }
    }
    case 'tv': {
      const b = w * 0.01
      const outer = new Path2D()
      rr(outer, x - b, y - b, w + 2 * b, h + 2 * b, b * 0.8)
      return {
        outer,
        screenRadii: Math.min(r, b * 0.3),
        under: ctx => {
          const c = shade(color, 0.15)
          for (const fx of [0.1, 0.9]) {
            const cx = x + w * fx
            const p = new Path2D()
            p.moveTo(cx - w * 0.012, y + h + b * 0.5)
            p.lineTo(cx + w * 0.012, y + h + b * 0.5)
            p.lineTo(cx + w * 0.03, y + h + h * 0.06)
            p.lineTo(cx - w * 0.03, y + h + h * 0.06)
            p.closePath()
            ctx.fillStyle = c
            ctx.fill(p)
          }
        },
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(outer)
        },
      }
    }
    case 'browser':
    case 'window': {
      const bar = w * (style === 'browser' ? 0.045 : 0.032)
      const R = Math.max(r, w * 0.012)
      const outer = new Path2D()
      rr(outer, x, y - bar, w, h + bar, R)
      return {
        outer,
        screenRadii: [0, 0, R, R],
        body: ctx => {
          ctx.fillStyle = color
          ctx.fill(outer)
          const colors = ['#ff5f57', '#febc2e', '#28c840']
          colors.forEach((c, i) => {
            ctx.fillStyle = c
            ctx.beginPath()
            ctx.arc(x + bar * 0.55 + i * bar * 0.42, y - bar / 2, bar * 0.12, 0, Math.PI * 2)
            ctx.fill()
          })
          if (style === 'browser') fill(ctx, shade(color, 0.14), p => rr(p, x + w * 0.25, y - bar * 0.74, w * 0.5, bar * 0.48, bar * 0.24))
        },
      }
    }
    default:
      return null
  }
}

function drawDevice(ctx: CanvasRenderingContext2D, d: DeviceSettings, image: Img | undefined, W: number, H: number, scale: number) {
  const aspect = image ? image.height / image.width : H / W
  const rect = deviceRect(aspect, W, H, d)
  const { x, y, w, h } = rect
  const cx = x + w / 2
  const cy = y + h / 2
  const radius = d.cornerRadius * (w / 400)
  const chrome = chromeGeometry(d.chrome.style, d.chrome.color, rect, radius)
  const screenRadii = chrome?.screenRadii ?? radius
  const screenPath = new Path2D()
  rr(screenPath, x, y, w, h, screenRadii)

  ctx.save()
  ctx.translate(cx, cy)
  if (d.rotation) ctx.rotate((d.rotation * Math.PI) / 180)
  if (d.perspective) ctx.transform(1, d.perspective * 0.01, 0, 1, 0, 0)
  ctx.translate(-cx, -cy)

  if (d.shadow.enabled) {
    ctx.save()
    applyShadow(ctx, d.shadow, scale)
    ctx.fillStyle = '#000000'
    ctx.fill(chrome?.outer ?? screenPath)
    ctx.restore()
  }
  if (chrome) {
    chrome.under?.(ctx)
    chrome.body(ctx)
  }
  ctx.save()
  ctx.clip(screenPath)
  if (image) ctx.drawImage(image, x, y, w, h)
  else {
    ctx.fillStyle = '#0b0b10'
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
  chrome?.over?.(ctx)

  if (d.border.enabled && d.border.width > 0) {
    const bw = d.border.width * (w / 400)
    ctx.globalAlpha = d.border.opacity / 100
    ctx.strokeStyle = d.border.color
    ctx.lineWidth = bw
    const p = new Path2D()
    rr(p, x - bw / 2, y - bw / 2, w + bw, h + bw, Array.isArray(screenRadii) ? screenRadii.map(v => v + bw / 2) : screenRadii + bw / 2)
    ctx.stroke(p)
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

// ---------------------------------------------------------------- text

let segmenterCache: { lang: string; seg: Intl.Segmenter } | null = null

function wordsOf(text: string, lang: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    if (!segmenterCache || segmenterCache.lang !== lang) {
      try {
        segmenterCache = { lang, seg: new Intl.Segmenter(lang, { granularity: 'word' }) }
      } catch {
        segmenterCache = { lang, seg: new Intl.Segmenter('en', { granularity: 'word' }) }
      }
    }
    return Array.from(segmenterCache.seg.segment(text), s => s.segment)
  }
  return text.split(/(\s+)/)
}

/** Greedy line wrapping that respects explicit newlines and CJK/Thai word boundaries. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lang = 'en'): string[] {
  const lines: string[] = []
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    const place = (token: string) => {
      if (!token.trim()) return
      if (ctx.measureText(token).width <= maxWidth) {
        line = token
        return
      }
      // A single token wider than the line (long compound word): break by character.
      for (const ch of Array.from(token)) {
        if (line && ctx.measureText(line + ch).width > maxWidth) {
          lines.push(line)
          line = ch
        } else line += ch
      }
    }
    for (const token of wordsOf(raw, lang)) {
      if (!line) {
        place(token)
      } else if (ctx.measureText((line + token).trimEnd()).width <= maxWidth) {
        line += token
      } else {
        lines.push(line.trimEnd())
        line = ''
        place(token)
      }
    }
    if (line.trim()) lines.push(line.trimEnd())
  }
  return lines
}

export interface TextLayoutLine {
  text: string
  y: number
  size: number
  kind: 'headline' | 'subheadline'
}

export interface TextLayout {
  lines: TextLayoutLine[]
  anchorX: number
  align: CanvasTextAlign
  bounds: Rect | null
}

function fontString(style: { italic: boolean; weight: string; font: string }, size: number) {
  return `${style.italic ? 'italic ' : ''}${style.weight} ${size}px ${cssFamily(style.font)}`
}

function applyCase(text: string, upper: boolean, lang: string) {
  return upper ? text.toLocaleUpperCase(lang) : text
}

export function layoutText(ctx: CanvasRenderingContext2D, screen: Screen, W: number, H: number, lang: string, chain: string[]): TextLayout {
  const t = screen.text
  const layout = effectiveLayout(t, lang)
  const rtl = isRtl(lang)
  const headline = t.headline.enabled ? resolveLocalized(screen.copy.headline, chain) ?? '' : ''
  const subheadline = t.subheadline.enabled ? resolveLocalized(screen.copy.subheadline, chain) ?? '' : ''
  const blockW = W * (t.maxWidth / 100)
  const centerX = W * (t.x / 100)
  let align: CanvasTextAlign = t.align
  if (rtl && align !== 'center') align = align === 'left' ? 'right' : 'left'
  const anchorX = align === 'left' ? centerX - blockW / 2 : align === 'right' ? centerX + blockW / 2 : centerX
  const lines: TextLayoutLine[] = []
  let y = 0
  let maxLineW = 0
  const measure = (kind: 'headline' | 'subheadline', text: string, size: number, lineHeight: number) => {
    const style = t[kind]
    ctx.font = fontString(style, size)
    setLetterSpacing(ctx, style.letterSpacing, size)
    const wrapped = wrapText(ctx, applyCase(text, style.uppercase, lang), blockW, lang)
    wrapped.forEach((line, i) => {
      lines.push({ text: line, y: y + i * lineHeight, size, kind })
      maxLineW = Math.max(maxLineW, ctx.measureText(line).width)
    })
    y += (wrapped.length - 1) * lineHeight + size
  }
  if (headline) measure('headline', headline, layout.headlineSize, layout.headlineSize * (layout.lineHeight / 100))
  if (subheadline) {
    if (headline) y += layout.headlineSize * (t.gap / 100)
    measure('subheadline', subheadline, layout.subheadlineSize, layout.subheadlineSize * 1.3)
  }
  setLetterSpacing(ctx, 0, 1)
  if (!lines.length) return { lines, anchorX, align, bounds: null }
  const top = t.position === 'top' ? H * (layout.offsetY / 100) : H * (1 - layout.offsetY / 100) - y
  for (const l of lines) l.y += top
  const left = align === 'left' ? anchorX : align === 'right' ? anchorX - maxLineW : anchorX - maxLineW / 2
  return { lines, anchorX, align, bounds: { x: left, y: top, w: maxLineW, h: y } }
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, spacing: number, size: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${(spacing / 100) * size}px`
}

function drawText(ctx: CanvasRenderingContext2D, screen: Screen, W: number, H: number, lang: string, chain: string[]) {
  const layout = layoutText(ctx, screen, W, H, lang, chain)
  if (!layout.lines.length) return
  ctx.save()
  ctx.direction = isRtl(lang) ? 'rtl' : 'ltr'
  ctx.textAlign = layout.align
  ctx.textBaseline = 'top'
  for (const line of layout.lines) {
    const style = screen.text[line.kind]
    ctx.font = fontString(style, line.size)
    setLetterSpacing(ctx, style.letterSpacing, line.size)
    ctx.fillStyle = hexToRgba(style.color, style.opacity / 100)
    ctx.fillText(line.text, layout.anchorX, line.y)
    if (style.underline || style.strikethrough) {
      const tw = ctx.measureText(line.text).width
      const left = layout.align === 'left' ? layout.anchorX : layout.align === 'right' ? layout.anchorX - tw : layout.anchorX - tw / 2
      const thick = Math.max(2, line.size * 0.05)
      if (style.underline) ctx.fillRect(left, line.y + line.size * 0.95, tw, thick)
      if (style.strikethrough) ctx.fillRect(left, line.y + line.size * 0.5, tw, thick)
    }
  }
  setLetterSpacing(ctx, 0, 1)
  ctx.restore()
}

// ---------------------------------------------------------------- elements

export function elementText(el: TextElement, chain: string[]): string {
  return resolveLocalized(el.texts, chain) ?? ''
}

/** Approximate element bounds in output pixels (for hit-testing in the editor). */
export function elementBounds(el: CanvasElement, W: number, H: number, image?: Drawable): Rect {
  const w = W * (el.width / 100)
  let h = w
  if (el.kind === 'image' && image) h = w * (image.height / image.width)
  if (el.kind === 'text') h = Math.max(el.fontSize * 1.4, w * 0.25)
  return { x: W * (el.x / 100) - w / 2, y: H * (el.y / 100) - h / 2, w, h }
}

function drawElements(ctx: CanvasRenderingContext2D, elements: CanvasElement[], layer: CanvasElement['layer'], W: number, H: number, scale: number, env: RenderEnv, missing: string[]) {
  for (const el of elements) {
    if (el.layer !== layer) continue
    ctx.save()
    ctx.globalAlpha = el.opacity / 100
    const elW = W * (el.width / 100)
    ctx.translate(W * (el.x / 100), H * (el.y / 100))
    if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180)
    if (el.kind === 'emoji') {
      ctx.font = `${elW * 0.85}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.emoji, 0, 0)
    } else if (el.kind === 'icon') {
      const img = env.getIcon(el)
      if (!img) missing.push(`icon:${el.icon}`)
      else {
        if (el.shadow.enabled) applyShadow(ctx, el.shadow, scale)
        ctx.drawImage(img, -elW / 2, -elW / 2, elW, elW)
      }
    } else if (el.kind === 'image') {
      const img = env.getImage(el.assetId)
      if (!img) missing.push(`image:${el.assetId}`)
      else {
        const elH = elW * (img.height / img.width)
        ctx.drawImage(img, -elW / 2, -elH / 2, elW, elH)
      }
    } else if (el.kind === 'text') {
      drawTextElement(ctx, el, elW, env)
    }
    ctx.restore()
  }
}

function drawTextElement(ctx: CanvasRenderingContext2D, el: TextElement, elW: number, env: RenderEnv) {
  const text = elementText(el, env.chain)
  if (!text) return
  const lang = env.chain[0]
  ctx.font = `${el.italic ? 'italic ' : ''}${el.fontWeight} ${el.fontSize}px ${cssFamily(el.font)}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = isRtl(lang) ? 'rtl' : 'ltr'
  const lines = wrapText(ctx, text, elW, lang)
  const lineH = el.fontSize * 1.1
  const totalH = (lines.length - 1) * lineH + el.fontSize
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width))
  if (el.frame !== 'none') drawElementFrame(ctx, el, maxW, totalH, env)
  ctx.fillStyle = el.color
  const startY = -totalH / 2 + el.fontSize / 2
  lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineH))
}

function drawElementFrame(ctx: CanvasRenderingContext2D, el: TextElement, textW: number, textH: number, env: RenderEnv) {
  const k = el.frameScale / 100
  const pad = el.fontSize * 0.45 * k
  const fw = textW + pad * 2.4
  const fh = textH + pad * 1.4
  ctx.save()
  ctx.strokeStyle = el.frameColor
  ctx.fillStyle = el.frameColor
  ctx.lineWidth = Math.max(2, el.fontSize * 0.05) * k
  if (el.frame === 'pill' || el.frame === 'outline-pill') {
    const p = new Path2D()
    rr(p, -fw / 2, -fh / 2, fw, fh, fh / 2)
    if (el.frame === 'pill') ctx.fill(p)
    else ctx.stroke(p)
  } else if (el.frame.startsWith('laurel-')) {
    const variant = el.frame.includes('detailed') ? 'laurel-detailed-left' : 'laurel-simple-left'
    const img = env.getLaurel(variant)
    if (img) drawLaurel(ctx, img, textW + pad * 2, textH + pad * 2, k, el.frameColor)
    if (el.frame.endsWith('-star')) drawStar(ctx, 0, -(textH + pad * 2) / 2 - el.fontSize * 0.2 * k, el.fontSize * 0.3 * k, el.frameColor)
  } else if (el.frame === 'badge-circle') {
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(fw, fh) / 2, 0, Math.PI * 2)
    ctx.stroke()
  } else if (el.frame === 'badge-ribbon') {
    const sw = fw
    const sh = fh + pad
    ctx.beginPath()
    ctx.moveTo(-sw / 2, -sh / 2)
    ctx.lineTo(sw / 2, -sh / 2)
    ctx.lineTo(sw / 2, sh / 2 - pad)
    ctx.lineTo(0, sh / 2)
    ctx.lineTo(-sw / 2, sh / 2 - pad)
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

function drawLaurel(ctx: CanvasRenderingContext2D, img: Img, w: number, h: number, k: number, color: string) {
  const branchH = h * 1.1 * k
  const branchW = branchH * (img.width / img.height)
  if (typeof document === 'undefined' || branchW < 1 || branchH < 1) return
  const tmp = document.createElement('canvas')
  tmp.width = Math.ceil(branchW)
  tmp.height = Math.ceil(branchH)
  const t = tmp.getContext('2d')
  if (!t) return
  t.drawImage(img, 0, 0, branchW, branchH)
  t.globalCompositeOperation = 'source-in'
  t.fillStyle = color
  t.fillRect(0, 0, branchW, branchH)
  const leftX = -w / 2 - branchW - 2 * k
  ctx.drawImage(tmp, leftX, -branchH / 2, branchW, branchH)
  ctx.save()
  ctx.scale(-1, 1)
  ctx.drawImage(tmp, leftX, -branchH / 2, branchW, branchH)
  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2
    const inner = outer + Math.PI / 5
    const op = [cx + Math.cos(outer) * size, cy + Math.sin(outer) * size] as const
    if (i === 0) ctx.moveTo(...op)
    else ctx.lineTo(...op)
    ctx.lineTo(cx + Math.cos(inner) * size * 0.4, cy + Math.sin(inner) * size * 0.4)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ---------------------------------------------------------------- popouts

function drawPopouts(ctx: CanvasRenderingContext2D, popouts: Popout[], img: Img, W: number, H: number, scale: number) {
  for (const p of popouts) {
    const sx = (p.cropX / 100) * img.width
    const sy = (p.cropY / 100) * img.height
    const sw = (p.cropWidth / 100) * img.width
    const sh = (p.cropHeight / 100) * img.height
    if (sw <= 0 || sh <= 0) continue
    const dw = W * (p.width / 100)
    const dh = dw * (sh / sw)
    ctx.save()
    ctx.globalAlpha = p.opacity / 100
    ctx.translate(W * (p.x / 100), H * (p.y / 100))
    if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180)
    const radius = p.cornerRadius * (dw / 300)
    const path = new Path2D()
    rr(path, -dw / 2, -dh / 2, dw, dh, radius)
    if (p.shadow.enabled) {
      ctx.save()
      applyShadow(ctx, p.shadow, scale)
      ctx.fillStyle = '#000000'
      ctx.fill(path)
      ctx.restore()
    }
    if (p.border.enabled && p.border.width > 0) {
      const bw = p.border.width
      ctx.save()
      ctx.globalAlpha = (p.opacity / 100) * (p.border.opacity / 100)
      ctx.fillStyle = p.border.color
      const bp = new Path2D()
      rr(bp, -dw / 2 - bw, -dh / 2 - bw, dw + bw * 2, dh + bw * 2, radius + bw)
      ctx.fill(bp)
      ctx.restore()
    }
    ctx.clip(path)
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }
}

// ---------------------------------------------------------------- resource discovery

export function screenFontSpecs(screen: Screen): Array<{ font: string; weight: string; italic: boolean }> {
  const specs = [
    { font: screen.text.headline.font, weight: screen.text.headline.weight, italic: screen.text.headline.italic },
    { font: screen.text.subheadline.font, weight: screen.text.subheadline.weight, italic: screen.text.subheadline.italic },
  ]
  for (const el of screen.elements) if (el.kind === 'text') specs.push({ font: el.font, weight: el.fontWeight, italic: el.italic })
  return specs
}

export function screenAssetIds(screen: Screen, chain: string[]): string[] {
  const ids: string[] = []
  const ref = screenImage(screen, chain)
  if (ref) ids.push(ref.assetId)
  if (screen.background.type === 'image' && screen.background.imageAssetId) ids.push(screen.background.imageAssetId)
  for (const el of screen.elements) if (el.kind === 'image') ids.push(el.assetId)
  return ids
}
