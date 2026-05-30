'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getStoredUserId, getStoredSession } from '../../../lib/session-utils'
import { studentApi } from '../../../lib/api'
import { Card } from '../../ui/card'

interface DebugData {
  userId?: string | null
  hasSession?: boolean
  hasToken?: boolean
  courseId?: string
  chapterId?: string
  course?: { data: unknown; error: unknown }
  chapters?: { data: unknown; error: unknown }
  error?: string
}

export default function DebugInfo() {
  const params = useParams()
  const courseId = params?.courseId as string
  const chapterId = params?.chapterId as string
  const [debugData, setDebugData] = useState<DebugData>({})

  useEffect(() => {
    const runDebug = async () => {
      try {
        const userId = getStoredUserId()
        const session = getStoredSession()
        
        let courseData: unknown = null
        let courseError: unknown = null
        let chaptersData: unknown = null
        let chaptersError: unknown = null

        try {
          const res = await studentApi.courses.list()
          const courses = (res.data as { courses?: Array<{ id: string }> })?.courses || []
          courseData = courses.find(c => c.id === courseId) ?? null
        } catch (e) {
          courseError = e instanceof Error ? e.message : String(e)
        }

        try {
          const res = await studentApi.courses.getChapters(courseId)
          chaptersData = (res.data as { chapters?: unknown[] })?.chapters || []
        } catch (e) {
          chaptersError = e instanceof Error ? e.message : String(e)
        }

        setDebugData({
          userId,
          hasSession: !!session,
          hasToken: !!session?.access_token,
          courseId,
          chapterId,
          course: { data: courseData, error: courseError },
          chapters: { data: chaptersData, error: chaptersError },
        })
      } catch (error) {
        setDebugData({ error: error instanceof Error ? error.message : String(error) })
      }
    }

    if (courseId && chapterId) {
      runDebug()
    }
  }, [courseId, chapterId])

  return (
    <Card className="p-4 mb-4 bg-yellow-50 border-yellow-200">
      <h3 className="font-bold text-yellow-800 mb-2">Debug Information</h3>
      <pre className="text-xs overflow-auto max-h-96 bg-white p-2 rounded">
        {JSON.stringify(debugData, null, 2)}
      </pre>
    </Card>
  )
}
