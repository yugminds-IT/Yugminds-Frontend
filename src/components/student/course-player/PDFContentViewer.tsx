'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Badge } from '../../ui/badge'
import { File, CheckCircle, Loader2, ExternalLink, Download, Volume2, Link as LinkIcon } from 'lucide-react'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import PdfPages from './PdfPages'
import { OFFICE_EXTENSIONS, courseFileUrl, getExtension } from './media'

interface PDFContentViewerProps {
  content: {
    id: string
    title: string
    content_url?: string
    content_type?: string
    chapter_id?: string
    course_id?: string
  }
  courseId?: string
  chapterId?: string
  chapterName?: string
  onComplete?: () => void
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac']

// Minimum time the document must be open before completion can be confirmed.
const MIN_DWELL_SECONDS = 8

export default function PDFContentViewer({ content, chapterName, onComplete }: PDFContentViewerProps) {
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [dwellDone, setDwellDone] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { isContentCompleted, isSaving } = useCourseProgressStore()
  const isCompleted = isContentCompleted(content.id)
  const saving = isSaving(content.id)

  const extension = useMemo(() => getExtension(content.content_url), [content.content_url])
  const declaredType = (content.content_type || '').toLowerCase()

  // This viewer backs every non-video, non-text content type the admin builder
  // can author: pdf, file, image, audio and link. Prefer the admin-declared
  // type and fall back to sniffing the URL extension (uploads are stored under
  // generated names, so the extension is the only other signal).
  const isPdf = declaredType === 'pdf' || (declaredType !== 'link' && extension === 'pdf')
  const isImage =
    declaredType === 'image' || (declaredType !== 'link' && IMAGE_EXTENSIONS.includes(extension))
  const isAudio =
    declaredType === 'audio' || (declaredType !== 'link' && AUDIO_EXTENSIONS.includes(extension))
  const isLink = declaredType === 'link'
  // Office's public viewer fetches the file itself, so it needs the original (public) URL.
  const officeViewerUrl =
    !isLink && content.content_url && OFFICE_EXTENSIONS.includes(extension)
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(content.content_url)}`
      : null

  // Only an inline PDF has a "loaded"/dwell signal to gate on. Everything else
  // (image, audio, link, downloadable file) is completed by explicit action —
  // without this, these types had no completion path at all, which left Next
  // permanently disabled and blocked the rest of the course.
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5" ref={containerRef}>
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 leading-snug">{shortTitle}</h2>
          {(isCompleted || saving) && (
            <Badge className={`flex-shrink-0 border-0 text-xs ${saving ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {saving
                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
                : <><CheckCircle className="h-3 w-3 mr-1" />Completed</>}
            </Badge>
          )}
        </div>

        {chapterName && <p className="text-sm text-gray-500 mb-4">{chapterName}</p>}

        {!content.content_url ? (
          <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
            <File className="h-14 w-14 mb-3 opacity-30" />
            <p>{isLink ? 'Link not available' : 'File not available'}</p>
          </div>
        ) : isImage ? (
          <a
            href={content.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-gray-200 bg-gray-50 p-2 sm:p-3"
            title="Open full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.content_url}
              alt={content.title}
              className="mx-auto max-h-[calc(100dvh-11rem)] w-auto max-w-full rounded object-contain"
            />
          </a>
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 sm:px-6 sm:py-10">
            <Volume2 className="h-12 w-12 text-gray-400" />
            <audio controls preload="metadata" className="w-full max-w-lg" src={content.content_url}>
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : officeViewerUrl ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <iframe
              src={officeViewerUrl}
              title={content.title}
              className="block h-[min(75dvh,calc(100dvh_-_10rem))] min-h-[280px] w-full"
              allowFullScreen
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-3 py-2">
              <span className="text-xs uppercase text-gray-400">{extension} file</span>
              <a
                href={courseFileUrl(content.content_url)}
                download
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 sm:py-16 bg-gray-50 rounded-lg border border-gray-200">
            {isLink ? (
              <LinkIcon className="h-14 w-14 text-blue-500" />
            ) : (
              <File className="h-14 w-14 text-red-500" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-800">{shortTitle}</p>
              {isLink ? (
                <p className="mt-0.5 max-w-[80vw] truncate text-xs text-gray-400 sm:max-w-md">{content.content_url}</p>
              ) : (
                extension && <p className="text-xs text-gray-400 uppercase mt-0.5">{extension} file</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {isLink ? (
                <button
                  onClick={() => window.open(content.content_url!, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open link
                </button>
              ) : (
                <>
                  <a
                    href={courseFileUrl(content.content_url)}
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
                </>
              )}
            </div>
          </div>
        )}

        {content.content_url && !isCompleted && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleMarkComplete}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 max-sm:w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5" ref={containerRef}>
      {/* Title + status */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex items-start gap-2.5">
          <File className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug">{shortTitle}</h2>
            {chapterName && <p className="text-sm text-gray-500 truncate">{chapterName}</p>}
          </div>
        </div>
        {(isCompleted || saving) && (
          <Badge className={`flex-shrink-0 border-0 text-xs ${saving ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {saving
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
              : <><CheckCircle className="h-3 w-3 mr-1" />Completed</>}
          </Badge>
        )}
      </div>

      {content.content_url ? (
        <PdfPages url={content.content_url} title={content.title} onLoaded={() => setPdfLoaded(true)} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
          <File className="h-14 w-14 mb-3 opacity-30" />
          <p>PDF not available</p>
        </div>
      )}

      {content.content_url && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => window.open(content.content_url!, '_blank', 'noopener,noreferrer')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </button>

          {!isCompleted && (
            <div className="flex flex-col items-end gap-1 max-sm:w-full max-sm:items-stretch">
              <button
                onClick={handleMarkComplete}
                disabled={saving || !canComplete}
                className="inline-flex items-center justify-center gap-2 max-sm:w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
