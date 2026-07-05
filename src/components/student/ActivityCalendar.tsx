'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface ActivityDay {
  date: string // YYYY-MM-DD
  hasLearning?: boolean
  hasAssignment?: boolean
}

interface ActivityCalendarProps {
  activityDays?: ActivityDay[]
  stats?: { label: string; value: number }[]
  legendLabels?: {
    dot?: string   // label for single dot (blue)
    line?: string  // label for line (hasBoth)
    greenDot?: string  // label for green dot (hasAssignment only)
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function ActivityCalendar({ activityDays = [], stats = [], legendLabels }: ActivityCalendarProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const activityMap = new Map(activityDays.map(d => [d.date, d]))
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm text-gray-900">{MONTHS[month]} {year}</span>
        <div className="flex gap-0.5">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-gray-400 font-medium pb-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="h-9" />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const act = activityMap.get(dateStr)
          const isToday = dateStr === todayStr
          const hasBoth = act?.hasLearning && act?.hasAssignment

          return (
            <div key={day} className="flex flex-col items-center mb-0.5">
              <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium
                ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
              >
                {day}
              </div>
              <div className="h-1.5 flex items-center justify-center mt-0.5">
                {hasBoth ? (
                  <div className="w-4 h-0.5 rounded-full bg-blue-500" />
                ) : act?.hasLearning ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                ) : act?.hasAssignment ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          {legendLabels?.dot ?? '1+ activities'}
        </span>
        {legendLabels?.greenDot && (
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {legendLabels.greenDot}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <span className="w-3 h-0.5 bg-blue-500 inline-block" />
          {legendLabels?.line ?? 'All goals done'}
        </span>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Last 4 weeks</p>
          <div className="flex gap-2">
            {stats.map(s => (
              <div key={s.label} className="text-center flex-1">
                <p className="text-2xl font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
