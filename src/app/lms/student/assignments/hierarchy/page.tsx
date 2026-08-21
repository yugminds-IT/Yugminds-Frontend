'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useStudentAssignments } from '@/hooks/useStudentData'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, ChevronRight, FileText, AlertCircle, Lock } from 'lucide-react'

type AssignmentRow = {
  id: string
  title?: string
  description?: string
  course_id?: string
  course_title?: string
  status?: string
  is_locked?: boolean
  unlocks_in_days?: number | null
}

export default function AssignmentHierarchyPage() {
  const { data: assignmentsData = [], isLoading, error } = useStudentAssignments()

  const grouped = useMemo(() => {
    const rows = (Array.isArray(assignmentsData) ? (assignmentsData as AssignmentRow[]) : []) ?? []
    const byCourse = new Map<string, { course_title: string; items: AssignmentRow[] }>()
    for (const a of rows) {
      const courseId = a.course_id ?? 'unknown'
      const courseTitle = a.course_title ?? 'Course'
      if (!byCourse.has(courseId)) byCourse.set(courseId, { course_title: courseTitle, items: [] })
      byCourse.get(courseId)!.items.push(a)
    }
    // sort assignments by status priority then title
    const priority = (s?: string) =>
      s === 'graded' ? 3 : s === 'submitted' ? 2 : s === 'in_progress' ? 1 : 0
    const courses = Array.from(byCourse.entries()).map(([course_id, v]) => ({
      course_id,
      course_title: v.course_title,
      items: v.items
        .slice()
        .sort((a, b) => priority(b.status) - priority(a.status) || (a.title ?? '').localeCompare(b.title ?? '')),
    }))
    courses.sort((a, b) => a.course_title.localeCompare(b.course_title))
    return courses
  }, [assignmentsData])

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Assignments</h2>
            <p className="text-gray-600 mb-4">
              {error instanceof Error ? error.message : 'Failed to load assignments'}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assignments by Course</h1>
          <p className="text-gray-600 mt-2">Browse assignments grouped by course.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/lms/student/assignments">
            <FileText className="h-4 w-4 mr-2" />
            Back to Assignments
          </Link>
        </Button>
      </div>

      {grouped.length === 0 ? (
        <Card className="p-10 text-center">
          <BookOpen className="h-14 w-14 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600">No assignments found.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((c) => (
            <Card key={c.course_id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{c.course_title}</h2>
                  <p className="text-sm text-gray-500">{c.items.length} assignment(s)</p>
                </div>
              </div>
              <div className="space-y-3">
                {c.items.map((a) =>
                  a.is_locked ? (
                    <div
                      key={a.id}
                      className="block rounded-lg border border-gray-200 opacity-70 cursor-not-allowed"
                      title={`Unlocks in ${a.unlocks_in_days} day${a.unlocks_in_days === 1 ? '' : 's'}`}
                    >
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex items-center gap-2">
                          <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                          <p className="font-medium text-gray-500 truncate">{a.title ?? 'Assignment'}</p>
                        </div>
                        <Badge variant="outline" className="text-gray-500 whitespace-nowrap">
                          Unlocks in {a.unlocks_in_days}d
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <Link
                      key={a.id}
                      href={`/lms/student/assignments/${a.id}/view`}
                      className="block rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{a.title ?? 'Assignment'}</p>
                          {a.description ? (
                            <p className="text-sm text-gray-600 truncate">{a.description}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Badge variant="outline" className="capitalize">
                            {a.status ?? 'not_started'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </Link>
                  ),
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}