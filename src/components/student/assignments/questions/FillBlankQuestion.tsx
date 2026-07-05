'use client'

import { memo, useMemo } from 'react'

interface FillBlankQuestionProps {
  question: {
    id?: string
    question: string
    question_text?: string
    correct_answer: string | string[]
    marks?: number
    hints?: string[]
  }
  index: number
  totalQuestions: number
  answers: string[]
  onAnswerChange: (blankIndex: number, answer: string) => void
  showCorrectAnswer?: boolean
  disabled?: boolean
}

function FillBlankQuestion({
  question,
  answers,
  onAnswerChange,
  showCorrectAnswer = false,
  disabled = false,
}: FillBlankQuestionProps) {
  const text = question.question || question.question_text || ''

  const { parts, blankCount } = useMemo(() => {
    const pattern = /(_{3,}|\[blank\]|\[BLANK\]|\{blank\}|\{BLANK\})/gi
    const matches = Array.from(text.matchAll(pattern))
    if (matches.length === 0) return { parts: [], blankCount: 1 }

    const parts: { text: string; isBlank: boolean; blankIdx: number }[] = []
    let last = 0
    let bi = 0
    for (const m of matches) {
      if (m.index! > last) parts.push({ text: text.slice(last, m.index), isBlank: false, blankIdx: -1 })
      parts.push({ text: '', isBlank: true, blankIdx: bi++ })
      last = m.index! + m[0].length
    }
    if (last < text.length) parts.push({ text: text.slice(last), isBlank: false, blankIdx: -1 })
    return { parts, blankCount: bi }
  }, [text])

  const correctAnswers = useMemo(() => {
    if (!question.correct_answer) return []
    if (Array.isArray(question.correct_answer))
      return question.correct_answer.map(a => String(a).toLowerCase().trim()).filter(Boolean)
    return String(question.correct_answer).split(/[,;]/).map(a => a.toLowerCase().trim()).filter(Boolean)
  }, [question.correct_answer])

  const checkBlank = (bi: number, val: string): boolean | undefined => {
    if (!showCorrectAnswer || !val.trim()) return undefined
    const norm = val.toLowerCase().trim()
    const target = correctAnswers[bi] ?? correctAnswers[0]
    return target === norm || correctAnswers.some(c => c === norm)
  }

  const renderInput = (bi: number) => {
    const val = answers[bi] || ''
    const result = checkBlank(bi, val)
    return (
      <span key={`blank-${bi}`} className="inline-flex items-center gap-1 mx-1">
        <input
          type="text"
          value={val}
          onChange={e => !disabled && onAnswerChange(bi, e.target.value)}
          disabled={disabled}
          placeholder="___"
          className={`min-w-[120px] px-3 py-1 text-sm border-2 rounded focus:outline-none transition-colors
            ${result === true ? 'border-green-500 bg-green-50 text-green-800' :
              result === false && val.trim() ? 'border-red-400 bg-red-50 text-red-700' :
              'border-gray-400 focus:border-blue-500'}
            ${disabled ? 'cursor-not-allowed bg-gray-50' : ''}
          `}
        />
        {showCorrectAnswer && result === true && (
          <span className="text-xs text-green-700 font-semibold">✓</span>
        )}
        {showCorrectAnswer && result === false && val.trim() && (
          <span className="text-xs text-red-600 font-semibold">✗</span>
        )}
      </span>
    )
  }

  return (
    <div>
      {parts.length > 0 ? (
        <p className="text-base text-gray-900 leading-relaxed mb-5">
          {parts.map((p, i) => p.isBlank ? renderInput(p.blankIdx) : <span key={i}>{p.text}</span>)}
        </p>
      ) : (
        <div>
          <p className="text-base text-gray-900 mb-4">{text}</p>
          {renderInput(0)}
        </div>
      )}

      {/* Correct answers in review */}
      {showCorrectAnswer && correctAnswers.length > 0 && (
        <div className="mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 mb-1">
            Correct answer{blankCount > 1 ? 's' : ''}:
          </p>
          <p className="text-sm text-blue-800">{correctAnswers.join(' / ')}</p>
        </div>
      )}

      {question.hints && question.hints.length > 0 && (
        <div className="mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Hint:</span> {question.hints[0]}
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(FillBlankQuestion)
