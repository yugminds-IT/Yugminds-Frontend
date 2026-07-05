'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ToastProvider } from '../ui/toast'
import { ConfirmProvider } from '../ui/confirm-dialog'
import { subscribeToLogoutBroadcast } from '@/lib/session-utils'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = subscribeToLogoutBroadcast()
    return unsubscribe
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}