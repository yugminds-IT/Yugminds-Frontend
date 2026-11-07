import { Check } from 'lucide-react'
import Droid from './Droid'

const RULES: Array<{ label: string; test: (p: string) => boolean }> = [
  { label: '8 or more letters', test: (p) => p.length >= 8 },
  { label: 'A capital letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A small letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol, like ! or #', test: (p) => /[^A-Za-z0-9]/.test(p) },
]
const WORDS = ['Start typing', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong']

/** Whether the password meets the rules the server checks (the symbol is a bonus, not required). */
export const passwordMeetsRules = (p: string) => RULES.slice(0, 4).every((r) => r.test(p))

/** A password coach: five steps, and the droid rolls along the track as the password gets stronger. */
export default function PasswordCoach({ password }: { password: string }) {
  const results = RULES.map((r) => r.test(password))
  const score = results.filter(Boolean).length
  return (
    <div className="pw" data-s={score} aria-live="polite">
      <div className="pw-track" style={{ '--p': Math.max(0.04, score / 5 - 0.1) } as React.CSSProperties}>
        <span className="pw-droid"><Droid /></span>
        <div className="pw-bar" aria-hidden="true">
          {RULES.map((_, i) => <i key={i} data-on={i < score} />)}
        </div>
      </div>
      <p className="pw-word"><b>{WORDS[score]}</b><span>{score >= 4 ? 'Nice and safe' : 'Tick off the list'}</span></p>
      <ul className="pw-list">
        {RULES.map((r, i) => (
          <li key={r.label} data-ok={results[i]}>
            <i><Check aria-hidden="true" /></i>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
