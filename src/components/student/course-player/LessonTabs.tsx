'use client'

import { useState } from 'react'
import { StickyNote, FolderDown, Info } from 'lucide-react'
import NoteTakingPanel from './NoteTakingPanel'
import ResourcesPanel from './ResourcesPanel'

interface Content {
  id: string
  title: string
  content_type?: string
  content_url?: string
  content_text?: string
}

interface LessonTabsProps {
  courseId: string
  chapterId?: string
  chapterName?: string
  content: Content
  /** all content items in the current chapter (used to derive downloadable resources) */
  chapterContents: Content[]
  courseDescription?: string
}

type Tab = 'overview' | 'notes' | 'resources'

const RESOURCE_TYPES = ['pdf', 'file', 'image', 'link', 'audio', 'doc']

/**
 * Udemy/Coursera-style tab strip shown beneath the content viewer.
 * Overview · Notes · Resources — reuses the existing NoteTakingPanel and
 * ResourcesPanel components (previously built but never surfaced).
 */
export default function LessonTabs({
  courseId,
  chapterId,
  content,
  chapterContents,
  courseDescription,
}: LessonTabsProps) {
  const [tab, setTab] = useState<Tab>('overview')

  const materials = chapterContents
    .filter(
      (c) =>
        RESOURCE_TYPES.includes((c.content_type || '').toLowerCase()) &&
        !!c.content_url,
    )
    .map((c) => ({
      id: c.id,
      title: c.title,
      file_url: c.content_url as string,
      file_type: c.content_type,
      chapter_id: chapterId || '',
    }))

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'notes', label: 'Notes', icon: <StickyNote className="h-4 w-4" /> },
    { id: 'resources', label: 'Resources', icon: <FolderDown className="h-4 w-4" />, badge: materials.length },
  ]

  // Show a description only when it isn't the lesson body itself (text/html
  // lessons already render their text in the main viewer above).
  const ct = (content.content_type || '').toLowerCase()
  const lessonDescription =
    ct !== 'text' && ct !== 'html' && content.content_text?.trim()
      ? content.content_text.trim()
      : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
      <div className="mc-tabs" role="tablist" aria-label="Lesson sections" style={{ marginBottom: '1.25rem' }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" className="mc-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && <b>{t.badge}</b>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mc-swap" style={{ display: 'grid', gap: '1.25rem' }}>
          {lessonDescription ? (
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>About this lesson</h4>
              <p className="text-gray-600 leading-relaxed mt-1.5 whitespace-pre-wrap">{lessonDescription}</p>
            </div>
          ) : null}

          {courseDescription?.trim() && (
            <div style={lessonDescription ? { paddingTop: '1.25rem', borderTop: '1.5px solid var(--sd-line)' } : undefined}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>About this course</h4>
              <p className="text-gray-600 leading-relaxed mt-1.5 whitespace-pre-wrap">{courseDescription.trim()}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="mc-swap">
          <NoteTakingPanel courseId={courseId} chapterId={chapterId} contentId={content.id} isOpen />
        </div>
      )}

      {tab === 'resources' && (
        <div className="mc-swap">
          <ResourcesPanel courseId={courseId} chapterId={chapterId} materials={materials} isOpen />
        </div>
      )}
    </div>
  )
}
