'use client'

import { useState } from 'react'
import {
  Check,
  ClipboardList,
  FileText,
  Headphones,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  PlayCircle,
  Presentation,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import Droid from '../../portal/Droid'

export type LessonKind = 'video' | 'reading' | 'slides' | 'file' | 'image' | 'audio' | 'link' | 'quiz' | 'assignment'

/** What each kind of lesson is called, and the one-line job a child has to do in it. */
export const LESSON_META: Record<LessonKind, { label: string; task: string; Icon: LucideIcon }> = {
  video: { label: 'Video', task: 'Watch the video to the end.', Icon: PlayCircle },
  reading: { label: 'Reading', task: 'Read all the way to the bottom.', Icon: BookOpen },
  slides: { label: 'Slides', task: 'Flip through the pages.', Icon: Presentation },
  file: { label: 'File', task: 'Open the file and take a look.', Icon: FileText },
  image: { label: 'Picture', task: 'Take a good look at the picture.', Icon: ImageIcon },
  audio: { label: 'Listening', task: 'Press play and listen.', Icon: Headphones },
  link: { label: 'Link', task: 'Open the link and explore.', Icon: LinkIcon },
  quiz: { label: 'Quiz', task: 'Answer the questions to unlock the next item.', Icon: ClipboardList },
  assignment: { label: 'Assignment', task: 'Finish this to unlock the next item.', Icon: ClipboardList },
}

/** Every lesson sits in the same frame: a type chip, the title, and what to do. */
export function LessonStage({
  kind,
  title,
  chapterName,
  task,
  wide = false,
  children,
}: {
  kind: LessonKind
  title: string
  chapterName?: string
  /** replaces the default one-line task; pass null to hide it */
  task?: string | null
  wide?: boolean
  children: React.ReactNode
}) {
  const { label, task: defaultTask, Icon } = LESSON_META[kind]
  const line = task === undefined ? defaultTask : task
  return (
    <div className="ls" data-wide={wide}>
      <p className="ls-head">
        <span className="ls-chip"><Icon aria-hidden="true" />{label}</span>
        {chapterName && <span className="ls-where">{chapterName}</span>}
      </p>
      <h1 className="ls-title">{title}</h1>
      {line && <p className="ls-task">{line}</p>}
      {children}
    </div>
  )
}

/**
 * The same finish step for every lesson: a droid, a plain hint (with a meter when we can measure),
 * and one big button. Locked, then ready, then done. Finishing pops a small burst once.
 * `auto` is for lessons that finish by themselves (quizzes), so there is no button to press.
 */
export function DoneDock({
  done,
  ready,
  saving = false,
  progress,
  hint,
  label = 'I am done',
  auto = false,
  onDone,
}: {
  done: boolean
  ready: boolean
  saving?: boolean
  /** 0 to 1 */
  progress?: number
  hint: string
  label?: string
  auto?: boolean
  onDone?: () => void
}) {
  // The burst only plays for a lesson finished while you are here, not for ones you reopen.
  const [openedDone] = useState(done)
  const state = done ? 'done' : saving ? 'saving' : ready ? 'ready' : 'locked'
  const title = done ? 'Nice work!' : saving ? 'Saving your progress' : ready && !auto ? 'All set!' : 'Almost there'
  const text = done ? 'You finished this one.' : saving ? 'One moment.' : ready && !auto ? 'Tap the button when you are done.' : hint

  return (
    <section className="ls-dock" data-state={state} aria-live="polite">
      <span className="ls-droid"><Droid /></span>
      <div className="ls-dock-text">
        <b>{title}</b>
        <small>{text}</small>
        {progress != null && state === 'locked' && (
          <span className="sd-meter" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress in this lesson">
            <i style={{ '--p': `${Math.min(100, Math.round(progress * 100))}%` } as React.CSSProperties} />
          </span>
        )}
      </div>
      {!auto && (
        <div className="ls-dock-act">
          {done ? (
            <span className="ls-donetag"><Check aria-hidden="true" />Done</span>
          ) : (
            <button className="sd-btn sd-btn--amber sd-btn--lg" disabled={state !== 'ready'} onClick={onDone}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {label}
            </button>
          )}
          {done && !openedDone && (
            <span className="ls-burst" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': `${i * 30}deg` } as React.CSSProperties} />)}
            </span>
          )}
        </div>
      )}
      {auto && done && <span className="ls-donetag"><Check aria-hidden="true" />Done</span>}
    </section>
  )
}
