# AGENTS.md

Guidance for coding agents (Claude Code, Codex, …) working in this repository.

## Project Overview

Storedeck — a browser-based editor for stylised store screenshots (App Store,
Google Play, Mac App Store, Microsoft Store, Steam, Amazon Fire TV, TV stores,
web/social). Built with **React 19 + TanStack Start** (Vite), Tailwind CSS v4,
Zustand + Immer, HTML5 Canvas and Three.js. Marketing/SEO pages are prerendered
to static HTML; the editor (`/editor`) is client-only.

## Agent Instructions

**Development server:**
- Start it yourself in the background: `pnpm dev` (Vite, default port 3000; pass
  `--port <n>` if taken). Tell the user which URL to open. Don't ask the user to
  start it.
- Watch the server output for errors and report problems.

**Git & commits:**
- Handle git operations yourself (add, commit, push).
- Before creating a commit, show the proposed commit message to the user and
  wait for approval. Only commit after approval.
- Follow conventional commit messages.

**Checks before handing work back:** `pnpm typecheck`, `pnpm test`, and for
routing/SEO changes `pnpm build` (it prerenders every page and fails on errors).

## Commands

```bash
pnpm install
pnpm dev         # dev server with HMR
pnpm build       # client + SSR build, prerender pages, sitemap/robots/llms files → dist/client
pnpm preview     # serve the production build
pnpm test        # vitest (jsdom + fake-indexeddb)
pnpm typecheck   # tsc --noEmit
```

Deploy `dist/client` to any static host (see `nginx.conf` / `Dockerfile`).

## Document model (`src/lib/model`)

```
Project ─ languages, defaultLanguage
 └─ Variant[]        A/B test arm: name, status (draft|control|testing|winner|archived), hypothesis
     └─ PlatformDeck[]   platformId (catalog), sizeId | custom size, orientation
         └─ Screen[]      images{lang→AssetRef}, copy{headline,subheadline}{lang→text},
                          background, device, text (style + per-language overrides),
                          elements (text|emoji|icon|image), popouts
```

- `types.ts` — the schema (`SCHEMA_VERSION = 3`).
- `platforms.ts` — store/platform/size catalog with sources and `SPEC_REVIEWED`
  date. Guides, size pages, the editor and WebMCP all read from it — update
  specs here only.
- `defaults.ts` — factories, gradient/position presets.
- `ops.ts` — pure document operations (lookups, localization fallbacks, strings
  table, cloning, cross-size adaptation, style transfer, validated patches).
- `legacy.ts` — importer for v1 (vanilla JS) projects/backups.
- `languages.ts` — language catalog, RTL, filename language detection.

## Editor state (`src/lib/editor`)

- `store.ts` — vanilla Zustand store (outside React). All document edits go
  through `mutate(label, recipe, { coalesceKey })`, which records Immer patches
  for undo/redo (edits with the same key within 1s merge — use it for sliders
  and drags) and schedules IndexedDB autosave. `select()` keeps the selection
  consistent (switching variant keeps platform + screen position).
- `actions.ts` — every domain action (projects, variants, platforms, screens,
  uploads, design setters, elements, popouts, languages, import/export). The UI
  and the WebMCP tools both call these; they validate input and throw
  descriptive errors.

## Storage (`src/lib/storage`)

- `db.ts` — IndexedDB (`storedeck`): `projects`, content-addressed `assets`
  (SHA-256 ids, shared across variants/platforms), `kv`.
- `assets.ts` — decoded image cache; `announceResourceReady()` bumps
  `assetsVersion` so canvases re-render when images/fonts/icons/models land.

## Rendering (`src/lib/render`)

- `canvas.ts` — `renderScreen(ctx, screen, size, scale, env)`. Works in output
  pixels; `scale` maps to canvas pixels, so previews and exports share one code
  path. Order: background → noise → elements(behind-device) → device (2D chrome
  or 3D) → elements(above-device) → popouts → text → elements(above-text).
  Also `layoutText`, `deviceRect`, `chromeBounds` (used for layout QA).
- `three.ts` — lazy-loaded Three.js renderer for 3D iPhone/Galaxy models
  (`public/models/*.glb`); `three-presets.ts` holds color presets.
- `fonts.ts` (Google Fonts loading), `icons.ts` (Lucide icons, lazy),
  `service.ts` (render env, `renderScreenImage`, export planning, ZIP export).

## WebMCP (`src/lib/webmcp`) — keep complete

Autonomous agents must be able to control everything the editor can do.
**When you add or change an editor capability, add/extend the matching tool.**

- `specs.ts` — tool names, descriptions and JSON schemas (pure data; the
  `/agents` page and `llms-full.txt` render from it).
- `tools.ts` — implementations bound to specs; inputs are validated by
  `schema.ts` before running; every tool ensures the editor is open.
- `register.ts` — registers with `document.modelContext` (falls back to
  `navigator.modelContext`). `src/routes/__root.tsx` registers on every page and
  exposes `window.storedeck.callTool(name, input)` for non-WebMCP automation.
- Tools: get_app_state, get_screen, get_platform_catalog, get_strings,
  get_images, select, set_view, manage_project, manage_variant,
  manage_platform, manage_screens, manage_languages, set_copy, copy_strings,
  set_background, set_device, set_text_style, manage_elements,
  manage_popouts, transfer_style, export, history.

## UI (`src/components`)

- `editor/` — `EditorApp` (shell, uploads, shortcuts), `Topbar` (projects,
  variants, views, languages, undo, export), `Sidebar` (platform decks, screen
  list), `Stage` (canvas + interactions), `Inspector` / `TextPanel` /
  `ElementsPanel`, `Views` (board, strings, compare), `ExportDialog`, `ui.tsx`
  primitives.
- `site/` — marketing layout, prose renderer.

## Routes & SEO (`src/routes`, `src/content`)

- `/`, `/guides`, `/guides/$slug`, `/screenshot-sizes`, `/screenshot-sizes/$store`,
  `/faq`, `/agents`, `/404` are prerendered; `/editor` is `ssr: false`
  (`?platform=<id>` deep-links a platform).
- Content is structured data in `src/content` (`guides.ts`, `faq.ts`), rendered
  to pages, JSON-LD (`TechArticle`, `FAQPage`, `BreadcrumbList`) and Markdown
  (`markdown.ts` → `llms.txt`, `llms-full.txt`). A `{ t: 'sizes' }` block renders
  live tables from the platform catalog.
- `lib/site.ts` — `seo()` (title, description, canonical, OG/Twitter) and
  `jsonLd()` helpers. `scripts/seo-files.ts` generates sitemap/robots/llms files; `scripts/seo-plugin.ts` serves them in dev and emits them at build.
- Use relative imports (not `~`) in `src/content`, `src/lib/model`,
  `src/lib/site.ts` and `src/lib/webmcp/specs.ts` — `scripts/seo-files.ts` loads them without the alias.

## External dependencies

TanStack Start/Router, React 19, Zustand, Immer, idb, Three.js (GLTFLoader),
JSZip, lucide (icons, lazy) / lucide-react (UI), Tailwind CSS v4, Google Fonts.
