'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { setAuthToken, studentApi } from '@/lib/api'
import { getSession } from '@/lib/session-utils'

export default function DebugPage() {
  const [status, setStatus] = useState<{
    auth: string
    api: string
    courses: string
    error?: string
  }>({
    auth: 'Checking...',
    api: 'Checking...',
    courses: 'Checking...',
  })

  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        // Test 1: Authentication
        const { data: { session } } = await getSession()
        if (!session) {
          setStatus(prev => ({ ...prev, auth: 'No active session' }))
          return
        }
        const user = session.user as { id: string; email?: string } | undefined
        setStatus(prev => ({
          ...prev,
          auth: `✅ Authenticated: ${user?.email || 'No email'}`,
        }))

        if (!user) {
          setStatus(prev => ({ ...prev, error: 'No authenticated user' }))
          return
        }

        // Test 2: API Call
        try {
          if (session.access_token) setAuthToken(session.access_token)
          const { data } = await studentApi.courses.list()
          setStatus(prev => ({
            ...prev,
            api: `✅ API OK: ${(data as { courses?: unknown[] })?.courses?.length || 0} courses`,
          }))
        } catch (apiError: unknown) {
          setStatus(prev => ({
            ...prev,
            api: `❌ API Error: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
          }))
        }

        // Test 3: Direct Database Query
        setStatus(prev => ({
          ...prev,
          courses: prev.courses,
        }))
      } catch (error: unknown) {
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      }
    }

    runDiagnostics()
  }, [])

  return (
    <div className="p-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">My Courses Debug</h1>
        <div className="space-y-4">
          <div>
            <strong>Authentication:</strong> {status.auth}
          </div>
          <div>
            <strong>API Endpoint:</strong> {status.api}
          </div>
          <div>
            <strong>Database:</strong> {status.courses}
          </div>
          {status.error && (
            <div className="text-red-600">
              <strong>Error:</strong> {status.error}
            </div>
          )}
          <Button onClick={() => window.location.href = '/lms/student/my-courses'}>
            Go to My Courses
          </Button>
        </div>
      </Card>
    </div>
  )
}


















