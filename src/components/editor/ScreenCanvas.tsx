import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { currentOf, useEditor } from '~/lib/editor/store'
import type { Screen } from '~/lib/model/types'
import { drawScreen } from '~/lib/render/service'

export function useCurrent() {
  const project = useEditor(s => s.project)
  const sel = useEditor(s => s.sel)
  return useMemo(() => currentOf({ project, sel }), [project, sel])
}

interface Props {
  screen: Screen
  size: { width: number; height: number }
  lang: string
  /** Displayed width in CSS pixels. */
  cssWidth: number
  /** Extra down-scaling for cheap thumbnails (0-1). */
  quality?: number
  className?: string
  title?: string
}

/**
 * Renders one screen. Re-renders only when the screen object (immer keeps
 * identity for untouched screens), language, size or loaded assets change.
 */
export const ScreenCanvas = forwardRef<HTMLCanvasElement, Props>(function ScreenCanvas({ screen, size, lang, cssWidth, quality = 1, className, title }, forwarded) {
  const ref = useRef<HTMLCanvasElement>(null)
  useImperativeHandle(forwarded, () => ref.current!, [])
  const languages = useEditor(s => s.project?.languages)
  const defaultLanguage = useEditor(s => s.project?.defaultLanguage)
  const assetsVersion = useEditor(s => s.assetsVersion)
  const cssHeight = (cssWidth * size.height) / size.width

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !languages || !defaultLanguage) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const scale = Math.min(1, (cssWidth * dpr * quality) / size.width)
    const frame = requestAnimationFrame(() => {
      drawScreen(canvas, screen, size, scale, { languages, defaultLanguage }, lang)
    })
    return () => cancelAnimationFrame(frame)
  }, [screen, size.width, size.height, lang, languages, defaultLanguage, assetsVersion, cssWidth, quality])

  return <canvas ref={ref} title={title} className={className} style={{ width: cssWidth, height: cssHeight, display: 'block' }} />
})
