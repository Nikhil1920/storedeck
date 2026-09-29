import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '~/components/site/NotFound'

export const Route = createFileRoute('/404')({
  head: () => ({ meta: [{ title: 'Page not found — Storedeck' }, { name: 'robots', content: 'noindex' }] }),
  component: NotFound,
})
