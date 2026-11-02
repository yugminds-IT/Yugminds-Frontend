/* A small looping picture for the product chooser: press the button, the signal runs along the wire, the LED lights. */
export default function JuniorArt() {
  return (
    <svg className="pv-svg" viewBox="0 0 300 200" aria-hidden="true">
      <rect className="pv-board" x="70" y="40" width="160" height="120" rx="10" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect className="ja-sock" x={90 + i * 34} y="48" width="24" height="14" rx="3" />
          <rect className="ja-sock" x={90 + i * 34} y="138" width="24" height="14" rx="3" />
        </g>
      ))}
      
      
      <path className="ja-wire" d="M40 170 H102 V152" />
      <path className="ja-flow" d="M40 170 H102 V152" />
      <path className="ja-wire" d="M262 24 H102 V46" />
      <path className="ja-flow ja-flow--2" d="M262 24 H102 V46" />
      <g transform="translate(28 150)" className="ja-btn">
        <rect className="pv-part" x="-20" y="-20" width="40" height="40" rx="6" />
        <circle className="ja-cap" r="9" />
      </g>
      <g transform="translate(262 40)">
        <circle className="pv-part" r="18" />
        <circle className="ja-led" r="8" />
      </g>
      <text className="pv-cap" x="28" y="190" textAnchor="middle">Button</text>
      <text className="pv-cap" x="262" y="76" textAnchor="middle">LED</text>
    </svg>
  );
}
