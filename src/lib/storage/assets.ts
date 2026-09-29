// Runtime image cache on top of the asset store. The renderer is synchronous,
// so images are decoded ahead of time and listeners re-render when they land.

import type { AssetRef } from '../model/types'
import { getAsset, putAssetBlob } from './db'

export type LoadedImage = HTMLImageElement

const images = new Map<string, LoadedImage>()
const pending = new Map<string, Promise<LoadedImage>>()
const failed = new Set<string>()
const listeners = new Set<() => void>()

export function onAssetLoaded(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notify() {
  for (const cb of listeners) cb()
}

let announceQueued = false
/** Fonts, icons and 3D models call this when they become available (batched per frame). */
export function announceResourceReady(): void {
  if (announceQueued) return
  announceQueued = true
  const run = () => {
    announceQueued = false
    notify()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 0)
}

function decode(src: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

/** Returns the decoded image if ready; otherwise starts loading and returns undefined. */
export function getImage(assetId: string | null | undefined): LoadedImage | undefined {
  if (!assetId) return undefined
  const img = images.get(assetId)
  if (img) return img
  if (!pending.has(assetId) && !failed.has(assetId)) void ensureImage(assetId).catch(() => {})
  return undefined
}

export function ensureImage(assetId: string): Promise<LoadedImage> {
  const ready = images.get(assetId)
  if (ready) return Promise.resolve(ready)
  let p = pending.get(assetId)
  if (!p) {
    p = (async () => {
      const stored = await getAsset(assetId)
      if (!stored) throw new Error(`Asset ${assetId} is missing from storage`)
      const img = await decode(URL.createObjectURL(stored.blob))
      images.set(assetId, img)
      return img
    })()
    pending.set(assetId, p)
    p.then(
      () => {
        pending.delete(assetId)
        notify()
      },
      () => {
        pending.delete(assetId)
        failed.add(assetId)
      },
    )
  }
  return p
}

export async function ensureImages(ids: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(ids)].map(id => ensureImage(id).catch(() => undefined)))
}

async function measure(blob: Blob): Promise<{ width: number; height: number; img: LoadedImage }> {
  const img = await decode(URL.createObjectURL(blob))
  return { width: img.naturalWidth, height: img.naturalHeight, img }
}

export async function importImageBlob(blob: Blob, name: string): Promise<AssetRef> {
  if (!blob.type.startsWith('image/')) throw new Error(`"${name}" is not an image`)
  const { width, height, img } = await measure(blob)
  const ref = await putAssetBlob(blob, { name, width, height })
  if (!images.has(ref.assetId)) images.set(ref.assetId, img)
  return ref
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid data URL')
  const [, type, base64, data] = match
  if (!base64) return new Blob([decodeURIComponent(data)], { type })
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function importDataUrl(dataUrl: string, name: string): Promise<AssetRef> {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error(`"${name}" must be a data:image/... URL (e.g. data:image/png;base64,...)`)
  }
  if (dataUrl.length > 40_000_000) throw new Error(`"${name}" is too large (max ~30 MB)`)
  return importImageBlob(dataUrlToBlob(dataUrl), name)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function assetToDataUrl(assetId: string): Promise<string> {
  const stored = await getAsset(assetId)
  if (!stored) throw new Error(`Asset ${assetId} is missing`)
  return blobToDataUrl(stored.blob)
}
