'use client'

import { memo } from 'react'

interface EssayQuestionProps {
  question: {
    id?: string
    question: string
    question_text?: string
    marks?: number
    word_limit?: number
  }
  index: number
  totalQuestions: number
  answer: string
  onAnswerChange: (answer: string) => void
  disabled?: boolean
}

function EssayQuestion({ question, answer, onAnswerChange, disabled = false }: EssayQuestionProps) {
  const text = question.question || question.question_text || ''
  const wordLimit = question.word_limit
  const wordCount = answer.trim() === '' ? 0 : answer.trim().split(/\s+/).length
  const isOverLimit = wordLimit ? wordCount > wordLimit : false

  return (
    <div>
      <p className="text-base text-gray-900 leading-relaxed mb-5">{text}</p>

      <textarea
        value={answer}
        onChange={e => !disabled && onAnswerChange(e.target.value)}
        disabled={disabled}
        rows={8}
        placeholder="Type your answer here..."
        className={`w-full px-4 py-3 text-sm text-gray-900 border-2 rounded-lg resize-none focus:outline-none transition-colors
          ${isOverLimit
            ? 'border-red-400 focus:border-red-500'
            : 'border-gray-200 focus:border-blue-500'
          }
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
        `}
        aria-label="Essay answer"
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {disabled ? '' : 'Your response will be saved automatically'}
        </span>
        {wordLimit ? (
          <span className={`text-xs font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
            {wordCount} / {wordLimit} words
            {isOverLimit && ` (${wordCount - wordLimit} over limit)`}
          </span>
        ) : (
          <span className="text-xs text-gray-400">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  )
}

export default memo(EssayQuestion)
