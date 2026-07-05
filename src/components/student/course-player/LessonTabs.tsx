'use client'

import { useState } from 'react'
import { FileText, StickyNote, FolderDown, Info } from 'lucide-react'
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

function typeLabel(t?: string): string {
  const x = (t || '').toLowerCase()
  if (x === 'video' || x === 'video_link') return 'Video'
  if (x === 'text' || x === 'html') return 'Reading'
  if (x === 'pdf' || x === 'file') return 'File'
  if (x === 'quiz') return 'Quiz'
  if (x === 'assignment') return 'Assignment'
  return 'Lesson'
}

/**
 * Udemy/Coursera-style tab strip shown beneath the content viewer.
 * Overview · Notes · Resources — reuses the existing NoteTakingPanel and
 * ResourcesPanel components (previously built but never surfaced).
 */
export default function LessonTabs({
  courseId,
  chapterId,
  chapterName,
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
    <div className="max-w-3xl mx-auto px-6 pb-12">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'text-blue-700' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.icon}
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span className="ml-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                {t.badge}
              </span>
            )}
            {tab === t.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t" />}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {typeLabel(content.content_type)}
                {chapterName ? ` · ${chapterName}` : ''}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
            {lessonDescription ? (
              <p className="text-sm text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">{lessonDescription}</p>
            ) : (
              <p className="text-sm text-gray-400 mt-2">No additional description for this lesson.</p>
            )}
          </div>

          {courseDescription?.trim() && (
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-1.5">About this course</h4>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{courseDescription.trim()}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <NoteTakingPanel
          courseId={courseId}
          chapterId={chapterId}
          contentId={content.id}
          isOpen
        />
      )}

      {tab === 'resources' && (
        <ResourcesPanel courseId={courseId} chapterId={chapterId} materials={materials} isOpen />
      )}
    </div>
  )
}
