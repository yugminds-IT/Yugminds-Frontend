const S3_PREFIX = 'https://s3bucket.yugminds.org/yugminds-uploads/'

/** The bucket sends no CORS headers; route it through the same-origin rewrite in next.config.js. */
export function courseFileUrl(url: string): string {
  return url.startsWith(S3_PREFIX) ? `/api/course-files/${url.slice(S3_PREFIX.length)}` : url
}

export function getExtension(url?: string): string {
  if (!url) return ''
  const clean = url.split('?')[0].split('#')[0]
  return (clean.split('.').pop() ?? '').toLowerCase()
}

export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'ogv']
export const OFFICE_EXTENSIONS = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']

function parse(url?: string): URL | null {
  try {
    return url ? new URL(url) : null
  } catch {
    return null
  }
}

/** Handles watch?v=, youtu.be/, embed/, shorts/, live/ and v/ links on any youtube host. */
export function youTubeId(url?: string): string | null {
  const u = parse(url)
  if (!u) return null
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  const v = u.searchParams.get('v')
  if (v) return v
  const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
  return m?.[1] ?? null
}

/** Embeddable player URL for hosts that can't be played by <video> or the YouTube API. */
export function iframeEmbedUrl(url?: string): string | null {
  const u = parse(url)
  if (!u) return null
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d+)/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  if (host === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id')
    return id ? `https://drive.google.com/file/d/${id}/preview` : null
  }
  if (host === 'loom.com') {
    const id = u.pathname.match(/\/(?:share|embed)\/([^/?#]+)/)?.[1]
    return id ? `https://www.loom.com/embed/${id}` : null
  }
  return null
}

/** True when a link/file item is really a video and should open in the video viewer. */
export function looksLikeVideo(url?: string): boolean {
  return !!youTubeId(url) || !!iframeEmbedUrl(url) || VIDEO_EXTENSIONS.includes(getExtension(url))
}
