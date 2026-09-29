import { vi } from 'vitest'

export const PNG = 'data:image/png;base64,iVBORw0KGgo='

/** Fresh module graph + empty database for each test. */
let previousDb: typeof import('../src/lib/storage/db') | null = null

export async function freshEditor() {
  await previousDb?.closeDb()
  vi.resetModules()
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase('storedeck')
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
  previousDb = await import('../src/lib/storage/db')
  const store = await import('../src/lib/editor/store')
  const actions = await import('../src/lib/editor/actions')
  await actions.initEditor()
  return { store, actions }
}
