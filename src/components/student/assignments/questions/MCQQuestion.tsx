'use client'

import React from 'react'
import QuestionHeading from './QuestionHeading'

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
  /** shows "Q{number}." and points inline with the question text */
  number?: number
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
  number,
}: MCQQuestionProps) {
  const text = question.question || question.question_text || ''
  const options = question.options || []
  const correctIdx = getCorrectIndex(question.correct_answer, options)

  return (
    <div>
      <QuestionHeading number={number} marks={question.marks}>{text}</QuestionHeading>

      {showCorrectAnswer && selectedAnswer === undefined && (
        <p className="qa-none">No answer was handed in for this question.</p>
      )}

      <div className="qa-list" role="radiogroup" aria-label="Answers">
        {options.map((option, i) => {
          const isSelected = selectedAnswer === i
          const isCorrectOption = showCorrectAnswer && correctIdx === i
          const isWrongSelection = showCorrectAnswer && isSelected && !isCorrectOption

          return (
            <label
              key={i}
              className="qa-opt"
              data-picked={isSelected && !showCorrectAnswer}
              data-right={isCorrectOption}
              data-wrong={isWrongSelection}
              data-locked={disabled}
            >
              <input
                type="radio"
                name={`q-${index}`}
                value={i}
                checked={isSelected}
                onChange={() => !disabled && onAnswerChange(i)}
                disabled={disabled}
              />
              <span className="qa-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
              <span className="qa-label">{option}</span>
              {showCorrectAnswer && isSelected && !isCorrectOption && <span className="qa-tag qa-tag--wrong">Your choice</span>}
              {isCorrectOption && <span className="qa-tag qa-tag--right">Right answer</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
