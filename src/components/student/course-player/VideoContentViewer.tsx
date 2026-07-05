'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge } from '../../ui/badge'
import { Play, Pause, Volume2, VolumeX, CheckCircle, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { useCourseProgressStore } from '../../../store/course-progress-store'

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

function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtu\.be\/)([^?&#]+)/,
    /(?:embed\/)([^?&#]+)/,
    /(?:watch\?v=)([^&?#]+)/,
    /(?:youtube\.com\/v\/)([^?&#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function VideoContentViewer({ content, onComplete }: VideoContentViewerProps) {
  const isYouTube =
    content.content_url?.includes('youtube.com') || content.content_url?.includes('youtu.be')
  const videoId = isYouTube ? extractYouTubeId(content.content_url || '') : null

  const { isContentCompleted, isSaving, setVideoPosition, getVideoPosition } =
    useCourseProgressStore()
  const isCompleted = isContentCompleted(content.id)
  const saving = isSaving(content.id)

  const [watchedFraction, setWatchedFraction] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(false)
  const watchedEnough = watchedFraction >= WATCH_THRESHOLD || isCompleted

  const handleMarkComplete = useCallback(() => {
    if (hasCompleted || !watchedEnough) return
    setHasCompleted(true)
    onComplete?.()
  }, [hasCompleted, watchedEnough, onComplete])

  const StatusBadge = () => {
    if (saving) return <Badge className="bg-blue-100 text-blue-700 text-xs border-0"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</Badge>
    if (isCompleted) return <Badge className="bg-green-100 text-green-700 text-xs border-0"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
    return null
  }

  // Shared "mark complete" footer
  const CompletionFooter = () =>
    isCompleted ? null : (
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round(watchedFraction * 100))}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {watchedEnough ? 'Ready to complete' : `Watch ${Math.round(WATCH_THRESHOLD * 100)}% to unlock completion (${Math.round(watchedFraction * 100)}%)`}
          </p>
        </div>
        <button
          onClick={handleMarkComplete}
          disabled={saving || !watchedEnough}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Mark as Complete
        </button>
      </div>
    )

  // ── YouTube (IFrame Player API for real playback tracking) ──────────────────
  if (isYouTube && videoId) {
    return <YouTubePlayer
      key={content.id}
      videoId={videoId}
      title={content.title}
      isCompleted={isCompleted}
      onFraction={setWatchedFraction}
      StatusBadge={StatusBadge}
      CompletionFooter={CompletionFooter}
    />
  }

  // ── Native HTML5 video ──────────────────────────────────────────────────────
  return <NativeVideoPlayer
    key={content.id}
    content={content}
    isCompleted={isCompleted}
    onFraction={setWatchedFraction}
    getVideoPosition={getVideoPosition}
    setVideoPosition={setVideoPosition}
    StatusBadge={StatusBadge}
    CompletionFooter={CompletionFooter}
  />
}

// ── YouTube sub-player ────────────────────────────────────────────────────────
function YouTubePlayer({
  videoId,
  title,
  isCompleted,
  onFraction,
  StatusBadge,
  CompletionFooter,
}: {
  videoId: string
  title: string
  isCompleted: boolean
  onFraction: (f: number) => void
  StatusBadge: () => React.ReactNode
  CompletionFooter: () => React.ReactNode
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            // 0 = ended → count as fully watched
            if (e.data === 0) onFraction(1)
          },
        },
      })
    })

    pollRef.current = setInterval(() => {
      const p = playerRef.current
      if (p && typeof p.getDuration === 'function' && typeof p.getCurrentTime === 'function') {
        const dur = p.getDuration() || 0
        const cur = p.getCurrentTime() || 0
        if (dur > 0) onFraction(Math.min(1, cur / dur))
      }
    }, 1000)

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
      try { playerRef.current?.destroy?.() } catch {}
    }
  }, [videoId, onFraction])

  return (
    <div>
      <div className="relative aspect-video bg-black w-full">
        <div ref={hostRef} className="w-full h-full" />
      </div>
      <div className="max-w-3xl mx-auto px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 leading-tight">{title}</h2>
          <StatusBadge />
        </div>
        {!isCompleted && <CompletionFooter />}
      </div>
    </div>
  )
}

// ── Native sub-player ─────────────────────────────────────────────────────────
function NativeVideoPlayer({
  content,
  isCompleted,
  onFraction,
  getVideoPosition,
  setVideoPosition,
  StatusBadge,
  CompletionFooter,
}: {
  content: { id: string; title: string; content_url?: string }
  isCompleted: boolean
  onFraction: (f: number) => void
  getVideoPosition: (id: string) => number
  setVideoPosition: (id: string, pos: number) => void
  StatusBadge: () => React.ReactNode
  CompletionFooter: () => React.ReactNode
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  // Initialise resume position from the cache on mount (component is keyed per
  // item, so it remounts fresh when switching content).
  const [resumePosition, setResumePosition] = useState<number | null>(() => {
    const local = getVideoPosition(content.id)
    return local > 0 ? local : null
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSavedPositionRef = useRef(0)

  const savePosition = useCallback(
    (position: number) => {
      if (position < 5) return
      if (Math.abs(position - lastSavedPositionRef.current) < 10) return
      lastSavedPositionRef.current = position
      setVideoPosition(content.id, position)
    },
    [content.id, setVideoPosition]
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      savePosition(video.currentTime)
      if (video.duration > 0) onFraction(Math.min(1, video.currentTime / video.duration))
    }
    const onMeta = () => {
      setDuration(video.duration)
      setIsLoading(false)
      if (resumePosition && resumePosition > 5 && resumePosition < video.duration - 5) {
        video.currentTime = resumePosition
        setCurrentTime(resumePosition)
      }
    }
    const onEnded = () => { setIsPlaying(false); onFraction(1) }
    const onCanPlay = () => setIsLoading(false)
    const onWaiting = () => setIsLoading(true)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('ended', onEnded)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('waiting', onWaiting)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('waiting', onWaiting)
    }
  }, [resumePosition, savePosition, onFraction])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause()
      else videoRef.current.play()
      setIsPlaying(!isPlaying)
    }
  }
  const toggleMute = () => {
    if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted) }
  }
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value)
    setCurrentTime(t)
    if (videoRef.current) videoRef.current.currentTime = t
  }
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (videoRef.current) videoRef.current.volume = v
  }

  return (
    <div>
      <div
        className="relative bg-black group w-full aspect-video"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {resumePosition && resumePosition > 5 && currentTime < 5 && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-black/80 rounded-lg p-3 flex items-center justify-between">
            <span className="text-white text-sm">Resume from {formatTime(resumePosition)}?</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20"
                onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; setCurrentTime(0); setResumePosition(null) } }}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Start over
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                onClick={() => { if (videoRef.current && resumePosition) { videoRef.current.currentTime = resumePosition; videoRef.current.play(); setIsPlaying(true) } }}>
                Resume
              </Button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          src={content.content_url}
          className="w-full h-full"
          onClick={togglePlay}
          controlsList="nodownload"
          onContextMenu={e => e.preventDefault()}
          aria-label={`Video: ${content.title}`}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
        )}

        {(showControls || !isPlaying) && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
            <div className="bg-black/40 rounded-full p-5 hover:bg-black/60 transition-colors">
              {isPlaying
                ? <Pause className="h-10 w-10 text-white fill-white" />
                : <Play className="h-10 w-10 text-white fill-white" />}
            </div>
          </div>
        )}

        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-8 transition-opacity ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
          <input
            type="range" min={0} max={duration || 0} value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-blue-500 mb-2"
            aria-label="Video progress"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-blue-300 transition-colors">
                {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-blue-300 transition-colors">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.1} value={volume}
                onChange={handleVolume} className="w-16 h-1 accent-white" aria-label="Volume" />
              <span className="text-white text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <select
              value={playbackRate}
              onChange={e => setPlaybackRate(parseFloat(e.target.value))}
              className="bg-transparent text-white text-xs border border-white/30 rounded px-1.5 py-0.5 cursor-pointer"
              aria-label="Playback speed"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                <option key={r} value={r} className="bg-gray-800">{r}x</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 leading-tight">{content.title}</h2>
          <StatusBadge />
        </div>
        {!isCompleted && <CompletionFooter />}
      </div>
    </div>
  )
}
