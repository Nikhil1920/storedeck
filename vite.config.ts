import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { seoFiles } from './scripts/seo-plugin.ts'

export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    tailwindcss(),
    seoFiles(),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoSubfolderIndex: true,
        failOnError: true,
        // Only crawl real pages: skip editor deep links (?platform=), anchors and generated text files.
        filter: ({ path }) => !path.includes('?') && !path.includes('#') && !/\.(txt|xml|json)$/.test(path),
      },
      // Static hosts serve this for unknown URLs (see nginx.conf).
      pages: [{ path: '/404' }],
    }),
    viteReact(),
  ],
})
