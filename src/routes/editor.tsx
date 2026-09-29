import { createFileRoute } from '@tanstack/react-router'
import { EditorApp } from '~/components/editor/EditorApp'
import { seo } from '~/lib/site'

export const Route = createFileRoute('/editor')({
  // The editor works entirely in the browser (canvas, IndexedDB, WebGL).
  ssr: false,
  // ?platform=<id> opens (or adds) that store platform — used by the size pages.
  validateSearch: (search: Record<string, unknown>): { platform?: string } => (typeof search.platform === 'string' ? { platform: search.platform } : {}),
  head: () =>
    seo({
      title: 'Editor — Storedeck',
      description: 'Design App Store, Google Play, desktop and TV store screenshots in your browser. Projects stay on your device.',
      path: '/editor',
    }),
  pendingComponent: EditorLoading,
  component: EditorRoute,
})

function EditorRoute() {
  const { platform } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <EditorApp openPlatform={platform} onPlatformOpened={() => navigate({ search: {}, replace: true })} />
}

function EditorLoading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[#0d0d12] text-sm text-[#9b9bae]">
      Loading the Storedeck editor…
    </div>
  )
}
