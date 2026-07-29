'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Badge } from '../../ui/badge'
import { File, CheckCircle, Loader2, ExternalLink, Download } from 'lucide-react'
import { useCourseProgressStore } from '../../../store/course-progress-store'

interface PDFContentViewerProps {
  content: {
    id: string
    title: string
    content_url?: string
    chapter_id?: string
    course_id?: string
  }
  courseId?: string
  chapterId?: string
  chapterName?: string
  onComplete?: () => void
}

// Minimum time the document must be open before completion can be confirmed.
const MIN_DWELL_SECONDS = 8

// Browsers can only render PDFs inline in an <iframe>. Any other "file"
// content (docx, pptx, xlsx, zip, ...) that the admin uploads through the
// same "material" upload flow would previously get embedded the same way —
// since the browser can't display it, it silently downloaded the file
// instead (and re-downloaded it every time the item was reopened). Detect
// the real extension and only iframe-embed actual PDFs; everything else
// gets a plain download card with a single explicit download action.
function getExtension(url?: string): string {
  if (!url) return ''
  const clean = url.split('?')[0].split('#')[0]
  const ext = clean.split('.').pop() ?? ''
  return ext.toLowerCase()
}

export default function PDFContentViewer({ content, chapterName, onComplete }: PDFContentViewerProps) {
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [dwellDone, setDwellDone] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { isContentCompleted, isSaving } = useCourseProgressStore()
  const isCompleted = isContentCompleted(content.id)
  const saving = isSaving(content.id)

  const extension = useMemo(() => getExtension(content.content_url), [content.content_url])
  const isPdf = extension === 'pdf'

  // Non-PDF files can't be previewed inline, so there's no "loaded"/"dwell"
  // signal to gate on — the download card itself is the only interaction.
  const canComplete = isPdf ? (pdfLoaded && dwellDone) || isCompleted : true

  // Explicit, gated completion only — never silent/auto.
  const handleMarkComplete = useCallback(() => {
    if (hasCompleted || !canComplete) return
    setHasCompleted(true)
    onComplete?.()
  }, [hasCompleted, canComplete, onComplete])

  // Start the dwell timer once the PDF iframe has loaded.
  useEffect(() => {
    if (!isPdf || !pdfLoaded || isCompleted) return
    const t = setTimeout(() => setDwellDone(true), MIN_DWELL_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [isPdf, pdfLoaded, isCompleted])

  const shortTitle = content.title.length > 60 ? content.title.slice(0, 57) + '…' : content.title

  if (!isPdf) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6" ref={containerRef}>
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="text-xl font-semibold text-gray-900 leading-snug">{shortTitle}</h2>
          {(isCompleted || saving) && (
            <Badge className={`flex-shrink-0 border-0 text-xs ${saving ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {saving
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
                : <><CheckCircle className="h-3 w-3 mr-1" />Completed</>}
            </Badge>
          )}
        </div>

        {chapterName && <p className="text-sm text-gray-500 mb-4">{chapterName}</p>}

        {content.content_url ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 bg-gray-50 rounded-lg border border-gray-200">
            <File className="h-14 w-14 text-red-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-800">{shortTitle}</p>
              {extension && <p className="text-xs text-gray-400 uppercase mt-0.5">{extension} file</p>}
            </div>
            <div className="flex items-center gap-3">
              <a
                href={content.content_url}
                download
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                onClick={() => window.open(content.content_url!, '_blank', 'noopener,noreferrer')}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
            <File className="h-14 w-14 mb-3 opacity-30" />
            <p>File not available</p>
          </div>
        )}

        {content.content_url && !isCompleted && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleMarkComplete}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Mark as Complete
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6" ref={containerRef}>
      {/* Title + status */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-xl font-semibold text-gray-900 leading-snug">{shortTitle}</h2>
        {(isCompleted || saving) && (
          <Badge className={`flex-shrink-0 border-0 text-xs ${saving ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {saving
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
              : <><CheckCircle className="h-3 w-3 mr-1" />Completed</>}
          </Badge>
        )}
      </div>

      {chapterName && <p className="text-sm text-gray-500 mb-4">{chapterName}</p>}

      {/* File header row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
        <File className="h-6 w-6 text-red-500 flex-shrink-0" />
        <span className="flex-1 text-sm text-gray-800 font-medium truncate">{shortTitle}</span>
        {isCompleted && (
          <Badge className="bg-green-100 text-green-700 border-0 text-xs flex-shrink-0">
            <CheckCircle className="h-3 w-3 mr-1" /> Viewed
          </Badge>
        )}
      </div>

      {/* PDF iframe — #toolbar=0 suppresses browser's download/print toolbar */}
      {content.content_url ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
          <iframe
            src={`${content.content_url}#toolbar=0&navpanes=0`}
            className="w-full"
            style={{ height: '70vh', minHeight: 480 }}
            title={content.title}
            onLoad={() => setPdfLoaded(true)}
            aria-label={`PDF document: ${content.title}`}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
          <File className="h-14 w-14 mb-3 opacity-30" />
          <p>PDF not available</p>
        </div>
      )}

      {content.content_url && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            onClick={() => window.open(content.content_url!, '_blank', 'noopener,noreferrer')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </button>

          {!isCompleted && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleMarkComplete}
                disabled={saving || !canComplete}
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Mark as Complete
              </button>
              {!canComplete && (
                <span className="text-xs text-gray-400">
                  {pdfLoaded ? 'Reviewing document…' : 'Loading document…'}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
