'use client'

import { memo, useMemo, useState, type DragEvent } from 'react'
import { X } from 'lucide-react'
import { availableWordChips } from '@/lib/word-bank'
import QuestionHeading from './QuestionHeading'

export const WORD_CHIP_MIME = 'application/x-word-chip'

interface FillBlankQuestionProps {
  question: {
    id?: string
    question: string
    question_text?: string
    correct_answer: string | string[]
    marks?: number
    hints?: string[]
    /** Correct + wrong words, shuffled by the server. Present = pick-a-word mode. */
    word_bank?: string[]
  }
  index: number
  totalQuestions: number
  answers: string[]
  onAnswerChange: (blankIndex: number, answer: string) => void
  showCorrectAnswer?: boolean
  disabled?: boolean
  /** shows "Q{number}." and points inline with the question text */
  number?: number
}

function FillBlankQuestion({
  question,
  answers,
  onAnswerChange,
  showCorrectAnswer = false,
  disabled = false,
  number,
}: FillBlankQuestionProps) {
  const text = question.question || question.question_text || ''
  const wordBank = question.word_bank?.length ? question.word_bank : null
  const [activeBlank, setActiveBlank] = useState<number | null>(null)
  const [dragOverBlank, setDragOverBlank] = useState<number | null>(null)

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

  const availableChips = useMemo(
    () => (wordBank ? availableWordChips(wordBank, answers, blankCount) : []),
    [wordBank, answers, blankCount],
  )

  const checkBlank = (bi: number, val: string): boolean | undefined => {
    if (!showCorrectAnswer || !val.trim()) return undefined
    const norm = val.toLowerCase().trim()
    const target = correctAnswers[bi] ?? correctAnswers[0]
    return target === norm || correctAnswers.some(c => c === norm)
  }

  const placeWord = (word: string, blank?: number) => {
    if (disabled) return
    let target = blank ?? activeBlank
    if (target == null || target >= blankCount) {
      target = Array.from({ length: blankCount }, (_, i) => i).find(i => !answers[i]) ?? blankCount - 1
    }
    onAnswerChange(target, word)
    const nextEmpty = Array.from({ length: blankCount }, (_, i) => i).find(i => i !== target && !answers[i])
    setActiveBlank(nextEmpty ?? null)
  }

  const onChipDragStart = (e: DragEvent, word: string) => {
    e.dataTransfer.setData(WORD_CHIP_MIME, word)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onSlotDrop = (e: DragEvent, bi: number) => {
    const word = e.dataTransfer.getData(WORD_CHIP_MIME)
    setDragOverBlank(null)
    if (!word) return
    e.preventDefault()
    placeWord(word, bi)
  }

  const renderSlot = (bi: number) => {
    const val = answers[bi] || ''
    const result = checkBlank(bi, val)
    const isActive = !disabled && activeBlank === bi
    const isDragOver = dragOverBlank === bi
    return (
      <span key={`blank-${bi}`} className="inline-flex items-center gap-1 mx-1 align-middle">
        <button
          type="button"
          disabled={disabled}
          data-drop-slot
          onClick={() => {
            if (val) onAnswerChange(bi, '')
            setActiveBlank(bi)
          }}
          onDragOver={e => {
            if (disabled || !Array.from(e.dataTransfer.types).includes(WORD_CHIP_MIME)) return
            e.preventDefault()
            setDragOverBlank(bi)
          }}
          onDragLeave={() => setDragOverBlank(null)}
          onDrop={e => onSlotDrop(e, bi)}
          aria-label={val ? `Blank ${bi + 1}: ${val}. Click to remove` : `Blank ${bi + 1}: empty`}
          className={`inline-flex min-w-[120px] min-h-[34px] items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-1 text-sm font-medium transition-colors
            ${result === true ? 'border-green-500 bg-green-50 text-green-800' :
              result === false ? 'border-red-400 bg-red-50 text-red-700' :
              val ? 'border-blue-500 bg-blue-50 text-blue-800' :
              isDragOver || isActive ? 'border-blue-500 border-dashed bg-blue-50/60' :
              'border-gray-300 border-dashed bg-white'}
            ${disabled ? 'cursor-default' : 'cursor-pointer'}
          `}
        >
          {val || <span className="text-xs font-normal text-gray-400">{isDragOver ? 'Drop here' : 'Place a word'}</span>}
          {val && !disabled && <X className="h-3.5 w-3.5 opacity-60" aria-hidden />}
        </button>
        {showCorrectAnswer && result === true && <span className="text-xs text-green-700 font-semibold">✓</span>}
        {showCorrectAnswer && result === false && <span className="text-xs text-red-600 font-semibold">✗</span>}
      </span>
    )
  }

  const renderInput = (bi: number) => {
    if (wordBank) return renderSlot(bi)
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
        <QuestionHeading number={number} marks={question.marks} className="leading-loose">
          {parts.map((p, i) => p.isBlank ? renderInput(p.blankIdx) : <span key={i}>{p.text}</span>)}
        </QuestionHeading>
      ) : (
        <div className="mb-5">
          <QuestionHeading number={number} marks={question.marks}>{text}</QuestionHeading>
          {renderInput(0)}
        </div>
      )}

      {wordBank && !disabled && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-medium text-gray-500">
            Tap a word or drag it into the blank. Tap a filled blank to take the word back.
          </p>
          <div className="flex flex-wrap gap-2">
            {availableChips.map(({ word, i }) => (
              <button
                key={`${word}-${i}`}
                type="button"
                draggable
                data-word-chip
                onDragStart={e => onChipDragStart(e, word)}
                onClick={() => placeWord(word)}
                className="rounded-lg border border-blue-200 bg-white px-3.5 py-1.5 text-sm font-medium text-blue-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow active:translate-y-0 cursor-grab active:cursor-grabbing"
              >
                {word}
              </button>
            ))}
            {availableChips.length === 0 && (
              <p className="text-xs text-gray-400">All words placed.</p>
            )}
          </div>
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
