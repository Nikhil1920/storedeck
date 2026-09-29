import 'fake-indexeddb/auto'
import { vi } from 'vitest'

// jsdom cannot decode images; replace asset decoding with deterministic fakes.
let seq = 0
vi.mock('../src/lib/storage/assets', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/lib/storage/assets')>()
  const fake = async (name: string) => {
    seq++
    return { assetId: `a_test${seq}`, name, width: 1290, height: 2796 }
  }
  return {
    ...actual,
    importImageBlob: (_b: Blob, name: string) => fake(name),
    importDataUrl: (_d: string, name: string) => fake(name),
    ensureImages: async () => {},
    getImage: () => undefined,
  }
})

// jsdom has no canvas backend; code paths handle a null context gracefully.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
