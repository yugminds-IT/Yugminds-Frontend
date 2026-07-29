'use client'

import React from 'react'

interface MCQQuestionProps {
  question: {
    id?: string
    question: string
    question_text?: string
    options: string[]
    correct_answer?: number | string
    marks?: number
  }
  index: number
  totalQuestions: number
  selectedAnswer?: number
  onAnswerChange: (answerIndex: number) => void
  showCorrectAnswer?: boolean
  disabled?: boolean
}

function getCorrectIndex(correct_answer: number | string | undefined, options: string[]): number | undefined {
  if (correct_answer === undefined || correct_answer === null) return undefined
  if (typeof correct_answer === 'number') return correct_answer
  // The question builder stores the correct answer as the option's TEXT, not
  // its index — prefer an exact text match first. Only fall back to reading
  // `correct_answer` as a raw index for legacy rows with no text match at
  // all, otherwise a numeric-looking option (e.g. options ["1","2","3","4"]
  // with "1" marked correct) gets misread as index 1 ("2") instead of index
  // 0 ("1"), highlighting the wrong option as correct.
  const textIdx = options.findIndex(o => o.toLowerCase().trim() === String(correct_answer).toLowerCase().trim())
  if (textIdx >= 0) return textIdx
  const parsed = parseInt(String(correct_answer))
  if (!isNaN(parsed) && parsed >= 0 && parsed < options.length) return parsed
  return undefined
}

export default function MCQQuestion({
  question,
  index,
  selectedAnswer,
  onAnswerChange,
  showCorrectAnswer = false,
  disabled = false,
}: MCQQuestionProps) {
  const text = question.question || question.question_text || ''
  const options = question.options || []
  const correctIdx = getCorrectIndex(question.correct_answer, options)

  return (
    <div>
      {/* Question text */}
      <p className="text-base text-gray-900 leading-relaxed mb-5">{text}</p>

      {/* No answer submitted notice */}
      {showCorrectAnswer && selectedAnswer === undefined && (
        <div className="mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 italic">No answer submitted for this question.</p>
        </div>
      )}

      {/* Options */}
      <div className="space-y-2.5" role="radiogroup">
        {options.map((option, i) => {
          const isSelected = selectedAnswer === i
          const isCorrectOption = showCorrectAnswer && correctIdx === i
          const isWrongSelection = showCorrectAnswer && isSelected && !isCorrectOption

          return (
            <label
              key={i}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border-2 cursor-pointer transition-all
                ${disabled ? 'cursor-not-allowed' : ''}
                ${isCorrectOption
                  ? 'border-green-500 bg-green-50'
                  : isWrongSelection
                  ? 'border-red-400 bg-red-50/40'
                  : isSelected && !showCorrectAnswer
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <input
                type="radio"
                name={`q-${index}`}
                value={i}
                checked={isSelected}
                onChange={() => !disabled && onAnswerChange(i)}
                disabled={disabled}
                className="sr-only"
              />
              {/* Radio circle */}
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                ${isCorrectOption
                  ? 'border-green-500 bg-green-500'
                  : isWrongSelection
                  ? 'border-red-400 bg-red-400'
                  : isSelected && !showCorrectAnswer
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-gray-400'
                }
              `}>
                {(isSelected || isCorrectOption) && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>

              {/* Letter */}
              <span className="text-sm font-medium text-gray-500 w-5 flex-shrink-0">
                {String.fromCharCode(65 + i)}.
              </span>

              {/* Option text */}
              <span className={`flex-1 text-sm ${isCorrectOption ? 'text-green-800 font-medium' : isWrongSelection ? 'text-red-700' : 'text-gray-800'}`}>
                {option}
              </span>

              {/* Labels */}
              {showCorrectAnswer && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isSelected && !isCorrectOption && (
                    <span className="text-xs text-red-600 font-medium">Your choice</span>
                  )}
                  {isCorrectOption && (
                    <span className="text-xs text-green-700 font-semibold">Correct Answer</span>
                  )}
                </div>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}
