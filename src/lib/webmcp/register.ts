// Registers the editor's WebMCP tools with the browser's model context
// (document.modelContext per the current spec; navigator.modelContext in
// early browser previews). Without WebMCP support this is a no-op.

import type { ToolDefinition } from './tools'

interface ModelContextLike {
  registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => unknown
  unregisterTool?: (name: string) => unknown
}

export function getModelContext(): ModelContextLike | null {
  if (typeof document === 'undefined') return null
  const candidates = [(document as unknown as { modelContext?: ModelContextLike }).modelContext, (navigator as unknown as { modelContext?: ModelContextLike }).modelContext]
  return candidates.find(c => c && typeof c.registerTool === 'function') ?? null
}

export const WEBMCP_VERSION = 'storedeck-v2'

let registered: AbortController | null = null

export async function registerWebMcpTools(tools: ToolDefinition[]): Promise<number> {
  const mc = getModelContext()
  if (!mc || registered) return 0
  registered = new AbortController()
  let ok = 0
  for (const tool of tools) {
    try {
      await mc.registerTool(
        {
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: (input: unknown, options?: { signal?: AbortSignal }) => tool.execute(input, { signal: options?.signal }),
        },
        { signal: registered.signal },
      )
      ok++
    } catch (e) {
      console.warn(`[WebMCP] registerTool failed for "${tool.name}":`, (e as Error).message ?? e)
    }
  }
  console.info(`[WebMCP] Registered ${ok}/${tools.length} Storedeck tools`)
  return ok
}
