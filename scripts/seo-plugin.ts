// Emits the generated SEO/LLM files into the client build and serves them
// during `vite dev`. The generator is loaded through Vite's module loader so
// the Vite config itself never imports application source.

import { fileURLToPath } from 'node:url'
import { createServer, type Plugin, type ViteDevServer } from 'vite'

type Generator = { buildSeoFiles: () => Promise<Record<string, string>> }
const GENERATOR = '/scripts/seo-files.ts'
const root = fileURLToPath(new URL('..', import.meta.url))

const TYPES: Record<string, string> = {
  'sitemap.xml': 'application/xml; charset=utf-8',
  'robots.txt': 'text/plain; charset=utf-8',
  'llms.txt': 'text/plain; charset=utf-8',
  'llms-full.txt': 'text/plain; charset=utf-8',
}

async function generate(server: ViteDevServer) {
  const mod = (await server.ssrLoadModule(GENERATOR)) as Generator
  return mod.buildSeoFiles()
}

export function seoFiles(): Plugin {
  return {
    name: 'storedeck-seo-files',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.split('?')[0].slice(1) ?? ''
        if (!(name in TYPES)) return next()
        try {
          const files = await generate(server)
          res.setHeader('Content-Type', TYPES[name])
          res.end(files[name])
        } catch (e) {
          next(e)
        }
      })
    },
    applyToEnvironment(env) {
      return env.name === 'client'
    },
    async generateBundle() {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, ws: false },
      })
      try {
        for (const [fileName, source] of Object.entries(await generate(server))) this.emitFile({ type: 'asset', fileName, source })
      } finally {
        await server.close()
      }
    },
  }
}
