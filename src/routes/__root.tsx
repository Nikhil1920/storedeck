/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useRouter } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { NotFound } from '~/components/site/NotFound'
import { SITE } from '~/lib/site'
import appCss from '~/styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${SITE.name} — ${SITE.tagline}` },
      { name: 'description', content: SITE.description },
      { name: 'theme-color', content: '#6a4de6' },
      { name: 'application-name', content: SITE.name },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
      { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'LLM-readable site summary' },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  useWebMcp(() => router.navigate({ to: '/editor' }))
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

/**
 * Registers the editor's WebMCP tools on every page (when the browser exposes
 * a model context) so agents landing on any URL can drive the editor. Tool
 * code loads lazily; calling a tool navigates to /editor first.
 * Also exposes `window.storedeck` for automation that can evaluate JS but
 * has no WebMCP support.
 */
function useWebMcp(goToEditor: () => Promise<void>) {
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [{ buildTools, setEnsureEditor }, { registerWebMcpTools, getModelContext }, actions] = await Promise.all([
        import('~/lib/webmcp/tools'),
        import('~/lib/webmcp/register'),
        import('~/lib/editor/actions'),
      ])
      setEnsureEditor(async () => {
        if (window.location.pathname !== '/editor') await goToEditor()
        await actions.initEditor()
      })
      const tools = buildTools()
      if (!cancelled && getModelContext()) await registerWebMcpTools(tools)
      return tools
    }
    let toolsPromise: ReturnType<typeof load> | null = null
    const ensure = () => (toolsPromise ??= load())
    ;(window as unknown as { storedeck: unknown }).storedeck = {
      listTools: async () => (await ensure()).map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema })),
      callTool: async (name: string, input: unknown) => {
        const tool = (await ensure()).find(t => t.name === name)
        if (!tool) throw new Error(`Unknown tool "${name}"`)
        return tool.execute(input)
      },
    }
    import('~/lib/webmcp/register').then(({ getModelContext }) => {
      if (getModelContext()) void ensure()
    })
    return () => {
      cancelled = true
    }
  }, [goToEditor])
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
