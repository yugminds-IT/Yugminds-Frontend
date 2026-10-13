'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { AlertCircle, Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react'

import { courseFileUrl } from './media'

const MIN_ZOOM = 0.75
const MAX_ZOOM = 3

/** Some embedded/in-app browsers construct Workers that never run, which leaves pdf.js hanging forever. */
function workersRun(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const src = URL.createObjectURL(new Blob(['postMessage(1)'], { type: 'text/javascript' }))
      const w = new Worker(src)
      const done = (ok: boolean) => {
        clearTimeout(timer)
        w.terminate()
        URL.revokeObjectURL(src)
        resolve(ok)
      }
      const timer = setTimeout(() => done(false), 1500)
      w.onmessage = () => done(true)
      w.onerror = () => done(false)
    } catch {
      resolve(false)
    }
  })
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null
function loadPdfjs() {
  // Legacy build: the modern one needs very recent Safari/Chrome, which many school phones lack.
  pdfjsPromise ??= Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), workersRun()]).then(
    async ([m, ok]) => {
      // Copied into public/ by the predev/prebuild scripts; Turbopack doesn't emit the worker from new URL(..., import.meta.url).
      m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      if (!ok) {
        // pdf.js parses on the main thread when this global is set.
        ;(globalThis as Record<string, unknown>).pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
      }
      return m as unknown as typeof import('pdfjs-dist')
    },
  )
  return pdfjsPromise
}

function PdfPage({ doc, pageNumber, width }: { doc: PDFDocumentProxy; pageNumber: number; width: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(pageNumber <= 2)
  const [aspect, setAspect] = useState(1.414)

  useEffect(() => {
    if (visible || !wrapperRef.current) return
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: '800px 0px' },
    )
    io.observe(wrapperRef.current)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !width) return
    let task: RenderTask | null = null
    let cancelled = false
    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      setAspect(base.height / base.width)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (width / base.width) * dpr })
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      task = page.render({ canvasContext: ctx, viewport })
      task.promise.catch(() => {})
    }).catch(() => {})
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, visible, width])

  return (
    <div
      ref={wrapperRef}
      className="mx-auto bg-white shadow-sm ring-1 ring-gray-200"
      style={{ width, height: width * aspect }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-label={`Page ${pageNumber}`} />
    </div>
  )
}

export default function PdfPages({
  url,
  title,
  onLoaded,
}: {
  url: string
  title: string
  onLoaded?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onLoadedRef = useRef(onLoaded)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [fitWidth, setFitWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    onLoadedRef.current = onLoaded
  }, [onLoaded])

  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    let destroyTask: (() => void) | null = null
    loadPdfjs()
      .then((pdfjs) => {
        const task = pdfjs.getDocument({ url: courseFileUrl(url) })
        destroyTask = () => void task.destroy()
        return task.promise
      })
      .then((d) => {
        loaded = d
        if (cancelled) return
        setDoc(d)
        onLoadedRef.current?.()
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
      if (loaded) void loaded.destroy()
      else destroyTask?.()
    }
  }, [url])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el)
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      setFitWidth(Math.max(0, Math.min(Math.floor(inner) - 2, 1000)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const pageWidth = Math.round(fitWidth * zoom)
  const btn =
    'inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40'

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[60] flex flex-col bg-gray-100'
          : 'overflow-hidden rounded-lg border border-gray-200 bg-gray-100'
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 py-1">
        <span className="min-w-0 truncate px-1 text-xs text-gray-500">
          {expanded ? title : doc ? `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}` : 'PDF'}
        </span>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className={btn}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
            disabled={!doc || zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="h-9 min-w-[3.25rem] rounded-md px-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            onClick={() => setZoom(1)}
            aria-label="Fit to width"
            title="Fit to width"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
            disabled={!doc || zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Exit full screen' : 'Full screen'}
            title={expanded ? 'Exit full screen' : 'Full screen'}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`overflow-x-auto p-2 sm:p-4 ${expanded ? 'flex-1 overflow-y-auto' : ''}`}
      >
        {error ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-gray-500">
            <AlertCircle className="h-8 w-8 text-gray-400" />
            Couldn&apos;t display this PDF here. Use &ldquo;Open in new tab&rdquo; below.
          </div>
        ) : !doc || !pageWidth ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex flex-col gap-3" style={{ width: Math.max(pageWidth, fitWidth) }}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i} doc={doc} pageNumber={i + 1} width={pageWidth} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
