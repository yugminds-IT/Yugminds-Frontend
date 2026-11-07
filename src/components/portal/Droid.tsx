/** The RoboCoders droid, small: a rolling ball body, a dome head and one amber eye. The portal's mascot. */
export default function Droid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 58" aria-hidden="true">
      <circle cx="24" cy="3" r="2.2" fill="#fbbf24" />
      <path d="M24 5v7" stroke="#bccaf0" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 27a14 14 0 0 1 28 0z" fill="#fbfcff" />
      <rect x="14" y="17" width="20" height="8" rx="4" fill="#0a1f4d" />
      <circle className="sd-eye" cx="24" cy="21" r="2.7" fill="#fbbf24" />
      <circle cx="24" cy="43" r="15" fill="#fbfcff" />
      <g className="sd-ball" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M24 28.5v29M9.5 43h29" />
        <circle cx="24" cy="43" r="8" stroke="#bccaf0" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
