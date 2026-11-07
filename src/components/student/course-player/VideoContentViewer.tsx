'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw, AlertCircle, Play } from 'lucide-react'
import { LessonStage, DoneDock } from './LessonStage'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { iframeEmbedUrl, youTubeId } from './media'

interface VideoContentViewerProps {
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
  onComplete?: () => void
}

// Fraction of the video that must be watched before completion can be confirmed.
const WATCH_THRESHOLD = 0.9
// Players we can't read progress from (Vimeo/Drive embeds, blocked YouTube API) unlock after this.
const UNTRACKED_UNLOCK_SECONDS = 30

// Keeps the whole 16:9 frame on screen under the player's top bar + bottom nav, in both orientations.
const FRAME =
  'relative mx-auto aspect-video w-[min(100%,max(20rem,calc((100dvh_-_20rem)*16/9)))] [@media(max-height:500px)]:w-[min(100%,calc((100dvh_-_5.5rem)*16/9))]'

// ── YouTube IFrame API loader (shared, loads the script once) ────────────────
let ytApiPromise: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.YT && w.YT.Player) return Promise.resolve()
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise<void>(resolve => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve()
    }
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/** Phones show fullscreen video sideways; turn the screen with it where the browser allows. */
function useLandscapeInFullscreen() {
  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>
    }
    const onChange = () => {
      if (document.fullscreenElement) orientation?.lock?.('landscape').catch(() => {})
      else orientation?.unlock?.()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
}

export default function VideoContentViewer({ content, onComplete }: VideoContentViewerProps) {
  const url = content.content_url || ''
  const ytId = youTubeId(url)
  const embedUrl = ytId ? null : iframeEmbedUrl(url)

  const { isContentCompleted, isSaving, setVideoPosition, getVideoPosition } =
    useCourseProgressStore()
  const isCompleted = isContentCompleted(content.id)
  const saving = isSaving(content.id)

  const [watchedFraction, setWatchedFraction] = useState(0)
  const [untracked, setUntracked] = useState(false)
  const [untrackedReady, setUntrackedReady] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const watchedEnough = watchedFraction >= WATCH_THRESHOLD || untrackedReady || isCompleted

  useLandscapeInFullscreen()

  useEffect(() => {
    if (!untracked || isCompleted) return
    const t = setTimeout(() => setUntrackedReady(true), UNTRACKED_UNLOCK_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [untracked, isCompleted])

  const markUntracked = useCallback(() => setUntracked(true), [])

  const handleMarkComplete = useCallback(() => {
    if (hasCompleted || !watchedEnough) return
    setHasCompleted(true)
    onComplete?.()
  }, [hasCompleted, watchedEnough, onComplete])

  let player: React.ReactNode
  if (!url) {
    player = (
      <div className="flex aspect-video items-center justify-center text-sm text-gray-300">This video is not available yet.</div>
    )
  } else if (ytId) {
    player = <YouTubePlayer key={content.id} videoId={ytId} title={content.title} onFraction={setWatchedFraction} onUntracked={markUntracked} />
  } else if (embedUrl) {
    player = <EmbedPlayer key={content.id} src={embedUrl} title={content.title} onMount={markUntracked} />
  } else {
    player = (
      <NativeVideoPlayer
        key={content.id}
        content={content}
        onFraction={setWatchedFraction}
        onFailed={markUntracked}
        getVideoPosition={getVideoPosition}
        setVideoPosition={setVideoPosition}
      />
    )
  }

  const hint = untracked
    ? 'Keep watching. The button unlocks in a few seconds.'
    : `You have watched ${Math.round(watchedFraction * 100)}%. The button unlocks near the end.`

  return (
    <LessonStage kind="video" title={content.title} wide>
      <div className="ls-frame ls-frame--video">{player}</div>
      {url && !ytId && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="ls-link">
          Open the video in a new tab
        </a>
      )}
      <DoneDock
        done={isCompleted}
        saving={saving}
        ready={watchedEnough && !hasCompleted}
        progress={untracked ? undefined : watchedFraction}
        hint={hint}
        onDone={handleMarkComplete}
      />
    </LessonStage>
  )
}

// ── YouTube: our own iframe (always plays), upgraded with the API for progress tracking ──
function YouTubePlayer({
  videoId,
  title,
  onFraction,
  onUntracked,
}: {
  videoId: string
  title: string
  onFraction: (f: number) => void
  onUntracked: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    let ready = false
    const giveUp = setTimeout(() => !ready && onUntracked(), 10000)
    loadYouTubeApi().then(() => {
      if (cancelled || !iframeRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      playerRef.current = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => { ready = true },
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) onFraction(1)
          },
        },
      })
    })
    const poll = setInterval(() => {
      const p = playerRef.current
      if (p && typeof p.getDuration === 'function' && typeof p.getCurrentTime === 'function') {
        const dur = p.getDuration() || 0
        if (dur > 0) onFraction(Math.min(1, (p.getCurrentTime() || 0) / dur))
      }
    }, 1000)
    return () => {
      cancelled = true
      clearTimeout(giveUp)
      clearInterval(poll)
      playerRef.current = null
    }
  }, [videoId, onFraction, onUntracked])

  return (
    <div className={FRAME}>
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  )
}

// ── Vimeo / Google Drive / Loom ──────────────────────────────────────────────
function EmbedPlayer({ src, title, onMount }: { src: string; title: string; onMount: () => void }) {
  useEffect(onMount, [onMount])
  return (
    <div className={FRAME}>
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

// ── Uploaded video files: native controls work with touch, fullscreen and rotation on every phone ──
function NativeVideoPlayer({
  content,
  onFraction,
  onFailed,
  getVideoPosition,
  setVideoPosition,
}: {
  content: { id: string; title: string; content_url?: string }
  onFraction: (f: number) => void
  onFailed: () => void
  getVideoPosition: (id: string) => number
  setVideoPosition: (id: string, pos: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSavedRef = useRef(0)
  const [failed, setFailed] = useState(false)
  const [resumeAt, setResumeAt] = useState<number | null>(() => {
    const local = getVideoPosition(content.id)
    return local > 5 ? local : null
  })

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    if (v.duration > 0) onFraction(Math.min(1, v.currentTime / v.duration))
    if (v.currentTime > 5) setResumeAt(null)
    if (v.currentTime >= 5 && Math.abs(v.currentTime - lastSavedRef.current) >= 10) {
      lastSavedRef.current = v.currentTime
      setVideoPosition(content.id, v.currentTime)
    }
  }

  if (failed) {
    return (
      <div className={`${FRAME} flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-300`}>
        <AlertCircle className="h-8 w-8 text-gray-400" />
        This video can&apos;t play here. Use &ldquo;Open the video in a new tab&rdquo; below.
      </div>
    )
  }

  return (
    <div className={FRAME}>
      <video
        ref={videoRef}
        src={content.content_url}
        className="absolute inset-0 h-full w-full"
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        onContextMenu={e => e.preventDefault()}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => onFraction(1)}
        onError={() => { setFailed(true); onFailed() }}
        aria-label={`Video: ${content.title}`}
      />
      {resumeAt && (
        <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#0a1f4d]/95 p-3 sm:inset-x-4 sm:top-4">
          <span className="text-sm font-semibold text-white">Carry on from {formatTime(resumeAt)}?</span>
          <div className="flex gap-2">
            <button className="sd-btn sd-btn--ghost-dark" style={{ minHeight: '2.4rem', padding: '0.3rem 1rem', fontSize: '0.9rem' }} onClick={() => setResumeAt(null)}>
              <RotateCcw aria-hidden="true" /> Start over
            </button>
            <button
              className="sd-btn sd-btn--amber"
              style={{ minHeight: '2.4rem', padding: '0.3rem 1rem', fontSize: '0.9rem' }}
              onClick={() => {
                const v = videoRef.current
                if (v) { v.currentTime = resumeAt; void v.play().catch(() => {}) }
                setResumeAt(null)
              }}
            >
              <Play aria-hidden="true" /> Carry on
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
