'use client'

import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  badge?: string
  /** hex accent used for the icon chip + left rule */
  accentColor?: string
  icon?: React.ReactNode
  /** tooltip text shown next to the title */
  info?: string
  className?: string
}

/**
 * Honest stat card for the student dashboard.
 *
 * Replaces the previous AreaChartAnalyticsCard usage, whose sparkline was
 * generated from a sine wave of the current value — i.e. fabricated trend
 * data. This card shows only real numbers.
 */
export function StatCard({
  title,
  value,
  description,
  badge,
  accentColor = '#2563eb',
  icon,
  info,
  className,
}: StatCardProps) {
  const displayValue =
    typeof value === 'number' ? value.toLocaleString('en-IN') : value

  return (
    <Card
      className={cn(
        'flex h-full min-h-[120px] flex-col justify-between gap-0 overflow-hidden p-0 shadow-none',
        className,
      )}
      style={{ '--stat-accent': accentColor } as React.CSSProperties}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-muted-foreground">
              {title}
            </span>
            {info && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger aria-label={`${title} details`} className="shrink-0">
                    <svg
                      width={16}
                      height={16}
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4 text-muted-foreground/50"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M10 16.25a6.25 6.25 0 100-12.5 6.25 6.25 0 000 12.5zm0-9.5a.9.9 0 100 1.8.9.9 0 000-1.8zm.85 3.1h-1.7v4.2h1.7v-4.2z"
                        fill="currentColor"
                      />
                    </svg>
                  </TooltipTrigger>
                  <TooltipContent showArrow className="max-w-72">
                    <p className="text-xs">{info}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--stat-accent) 12%, transparent)',
              color: 'var(--stat-accent)',
            }}
          >
            {icon}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {displayValue}
            </div>
            {description && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {badge && (
            <Badge
              variant="secondary"
              className="rounded-full text-[10px] font-medium"
            >
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
