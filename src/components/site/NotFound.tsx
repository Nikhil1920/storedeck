import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">This page is not in the deck</h1>
      <p className="max-w-md text-zinc-600">The page you are looking for does not exist. Try the guides or open the editor.</p>
      <div className="flex gap-3">
        <Link to="/" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Home
        </Link>
        <Link to="/editor" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800">
          Open editor
        </Link>
      </div>
    </main>
  )
}
