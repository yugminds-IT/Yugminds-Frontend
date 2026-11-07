'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { File, ExternalLink, Download, Headphones, Link as LinkIcon } from 'lucide-react'
import { LessonStage, DoneDock, type LessonKind } from './LessonStage'
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
  const kind: LessonKind = isPdf ? 'slides' : isImage ? 'image' : isAudio ? 'audio' : isLink ? 'link' : 'file'
  const url = content.content_url

  let body: React.ReactNode
  if (!url) {
    body = (
      <div className="ls-card">
        <span className="ls-card-ico"><File aria-hidden="true" /></span>
        <b>{isLink ? 'This link is not ready yet' : 'This file is not ready yet'}</b>
        <p>Ask your teacher to add it.</p>
      </div>
    )
  } else if (isPdf) {
    body = (
      <div className="ls-frame">
        <PdfPages url={url} title={content.title} onLoaded={() => setPdfLoaded(true)} />
      </div>
    )
  } else if (isImage) {
    body = (
      <a href={url} target="_blank" rel="noopener noreferrer" className="ls-frame ls-frame--img" title="Open the full picture">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={content.title} />
      </a>
    )
  } else if (isAudio) {
    body = (
      <div className="ls-card">
        <span className="ls-card-ico"><Headphones aria-hidden="true" /></span>
        <b>{shortTitle}</b>
        <audio controls preload="metadata" src={url}>Your browser cannot play audio.</audio>
      </div>
    )
  } else if (officeViewerUrl) {
    body = (
      <div className="ls-frame">
        <iframe
          src={officeViewerUrl}
          title={content.title}
          className="block h-[min(70dvh,calc(100dvh_-_16rem))] min-h-[280px] w-full"
          allowFullScreen
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5" style={{ borderColor: 'var(--sd-line)' }}>
          <span className="text-sm">{extension.toUpperCase()} file</span>
          <a href={courseFileUrl(url)} download className="ls-link"><Download className="mr-1 inline h-4 w-4" />Download</a>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="ls-card">
        <span className="ls-card-ico">{isLink ? <LinkIcon aria-hidden="true" /> : <File aria-hidden="true" />}</span>
        <b>{shortTitle}</b>
        {isLink ? <p>{url}</p> : extension && <p>{extension.toUpperCase()} file</p>}
        <div className="ls-acts">
          {isLink ? (
            <button className="sd-btn sd-btn--ink sd-btn--lg" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
              <ExternalLink aria-hidden="true" />Open the link
            </button>
          ) : (
            <>
              <a href={courseFileUrl(url)} download className="sd-btn sd-btn--ink sd-btn--lg"><Download aria-hidden="true" />Download</a>
              <button className="sd-btn sd-btn--line sd-btn--lg" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                <ExternalLink aria-hidden="true" />Open in a new tab
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <LessonStage kind={kind} title={shortTitle} chapterName={chapterName} wide={isPdf || !!officeViewerUrl}>
        {body}
        {isPdf && url && (
          <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="ls-link">
            Open the slides in a new tab
          </button>
        )}
        {url && (
          <DoneDock
            done={isCompleted}
            saving={saving}
            ready={canComplete && !hasCompleted}
            hint={pdfLoaded ? 'Look through the pages. The button unlocks in a moment.' : 'Loading the slides.'}
            onDone={handleMarkComplete}
          />
        )}
      </LessonStage>
    </div>
  )
}
