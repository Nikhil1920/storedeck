// Lucide icons rendered to images for the canvas. The icon set is loaded
// lazily (it is large) and each colour/stroke combination is cached.

import type { IconElement } from '../model/types'
import { announceResourceReady } from '../storage/assets'

type IconNode = Array<[string, Record<string, string | number>]>
let iconsPromise: Promise<Record<string, IconNode>> | null = null

export function loadIconSet(): Promise<Record<string, IconNode>> {
  if (!iconsPromise) iconsPromise = import('lucide').then(m => m.icons as unknown as Record<string, IconNode>)
  return iconsPromise
}

export const POPULAR_ICONS = [
  'star', 'heart', 'zap', 'sparkles', 'check', 'shield-check', 'lock', 'bell', 'trophy', 'crown', 'rocket', 'gift',
  'thumbs-up', 'smile', 'sun', 'moon', 'cloud', 'globe', 'map-pin', 'calendar', 'clock', 'camera', 'image', 'music',
  'play', 'mic', 'message-circle', 'mail', 'phone', 'user', 'users', 'search', 'settings', 'download', 'share-2',
  'bookmark', 'flag', 'tag', 'credit-card', 'shopping-cart', 'wallet', 'chart-line', 'target', 'award', 'badge-check',
  'flame', 'leaf', 'wifi', 'battery-full', 'fingerprint', 'eye', 'wand-sparkles', 'brain', 'bot', 'languages',
]

export function toPascal(kebab: string): string {
  return kebab.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

export function toKebab(pascal: string): string {
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
}

export async function iconNames(): Promise<string[]> {
  const icons = await loadIconSet()
  return Object.keys(icons).map(toKebab)
}

export async function iconExists(name: string): Promise<boolean> {
  const icons = await loadIconSet()
  return toPascal(name) in icons
}

const escapeAttr = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

export async function iconSvg(name: string, color: string, strokeWidth: number, size = 256): Promise<string> {
  const icons = await loadIconSet()
  const node = icons[toPascal(name)]
  if (!node) throw new Error(`Unknown icon "${name}" (use Lucide names like "star", "shield-check")`)
  const children = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')}/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${escapeAttr(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`
}

const cache = new Map<string, HTMLImageElement>()
const pending = new Set<string>()

function keyOf(el: Pick<IconElement, 'icon' | 'color' | 'strokeWidth'>) {
  return `${el.icon}|${el.color}|${el.strokeWidth}`
}

export async function ensureIcon(el: Pick<IconElement, 'icon' | 'color' | 'strokeWidth'>): Promise<HTMLImageElement> {
  const key = keyOf(el)
  const hit = cache.get(key)
  if (hit) return hit
  const svg = await iconSvg(el.icon, el.color, el.strokeWidth)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  cache.set(key, img)
  return img
}

/** Synchronous accessor for the renderer; kicks off loading when missing. */
export function getIconImage(el: IconElement): HTMLImageElement | undefined {
  const key = keyOf(el)
  const hit = cache.get(key)
  if (hit) return hit
  if (!pending.has(key) && typeof document !== 'undefined') {
    pending.add(key)
    ensureIcon(el)
      .then(() => announceResourceReady())
      .catch(err => console.warn('[icons]', err.message))
      .finally(() => pending.delete(key))
  }
  return undefined
}

const laurels = new Map<string, HTMLImageElement>()
export function getLaurel(variant: 'laurel-simple-left' | 'laurel-detailed-left'): HTMLImageElement | undefined {
  if (typeof document === 'undefined') return undefined
  let img = laurels.get(variant)
  if (!img) {
    img = new Image()
    img.onload = () => announceResourceReady()
    img.src = `/img/${variant}.svg`
    laurels.set(variant, img)
  }
  return img.complete && img.naturalWidth ? img : undefined
}
