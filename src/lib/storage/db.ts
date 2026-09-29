// IndexedDB persistence. Projects are small JSON documents; image bytes live in
// a content-addressed `assets` store so duplicated variants/platforms share them.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AssetRef, Project } from '../model/types'

export interface StoredAsset {
  id: string
  blob: Blob
  type: string
  name: string
  width: number
  height: number
  createdAt: number
}

interface StoredeckDB extends DBSchema {
  projects: { key: string; value: Project }
  assets: { key: string; value: StoredAsset }
  kv: { key: string; value: unknown }
}

const DB_NAME = 'storedeck'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<StoredeckDB>> | null = null

export function getDb(): Promise<IDBPDatabase<StoredeckDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StoredeckDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      },
    })
  }
  return dbPromise
}

/** Closes the connection (tests and database resets). */
export async function closeDb(): Promise<void> {
  const p = dbPromise
  dbPromise = null
  if (p) (await p).close()
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb()
  return db.getAll('projects')
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb()
  return db.get('projects', id)
}

export async function putProject(project: Project): Promise<void> {
  const db = await getDb()
  await db.put('projects', project)
}

export async function deleteProjectRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('projects', id)
}

export async function getKv<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  return (await db.get('kv', key)) as T | undefined
}

export async function setKv(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('kv', value, key)
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

/** Stores a blob under its content hash; identical images are stored once. */
export async function putAssetBlob(blob: Blob, meta: { name: string; width: number; height: number }): Promise<AssetRef> {
  const hash = await sha256Hex(await blob.arrayBuffer())
  const id = `a_${hash.slice(0, 24)}`
  const db = await getDb()
  const existing = await db.get('assets', id)
  if (!existing) {
    await db.put('assets', { id, blob, type: blob.type || 'image/png', name: meta.name, width: meta.width, height: meta.height, createdAt: Date.now() })
  }
  return { assetId: id, name: meta.name, width: meta.width, height: meta.height }
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  const db = await getDb()
  return db.get('assets', id)
}

/** Deletes assets no project references any more. */
export async function collectGarbageAssets(referenced: Set<string>): Promise<number> {
  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')
  let removed = 0
  for (const key of await tx.store.getAllKeys()) {
    if (!referenced.has(key)) {
      await tx.store.delete(key)
      removed++
    }
  }
  await tx.done
  return removed
}

// ---------------------------------------------------------------- legacy v1 database

const LEGACY_DB = 'AppStoreScreenshotGenerator'

export async function legacyDatabaseExists(): Promise<boolean> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return false
  const dbs = await indexedDB.databases()
  return dbs.some(d => d.name === LEGACY_DB)
}

export interface LegacyDump {
  projects: Array<Record<string, unknown>>
  names: Record<string, string>
}

/** Reads the v1 database without upgrading or modifying it. */
export async function readLegacyDatabase(): Promise<LegacyDump> {
  const raw = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const readAll = (store: string) =>
    new Promise<unknown[]>(resolve => {
      if (!raw.objectStoreNames.contains(store)) return resolve([])
      const req = raw.transaction(store, 'readonly').objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve([])
    })
  const projects = (await readAll('projects')) as Array<Record<string, unknown>>
  const meta = (await readAll('meta')) as Array<{ key: string; value: unknown }>
  raw.close()
  return { projects, names: legacyNames(meta) }
}

export function legacyNames(meta: Array<{ key: string; value: unknown }>): Record<string, string> {
  const names: Record<string, string> = {}
  const list = meta.find(m => m.key === 'projects')?.value
  if (Array.isArray(list)) for (const p of list) if (p?.id) names[p.id] = p.name
  return names
}
