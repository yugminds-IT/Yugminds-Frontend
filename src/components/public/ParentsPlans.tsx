"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

const PLANS = [
  { name: "Single course", price: "₹999", per: "per course", cost: (n: number) => 999 * n, features: ["Duration: 12-14 weeks", "All materials included", "Certificate of completion", "Progress reports"] },
  { name: "Semester plan", price: "₹1,499", per: "per semester", popular: true, cost: (n: number) => Math.ceil(n / 2) * 1499, features: ["2 courses of your choice", "All materials included", "Certificate of completion", "Portfolio development", "Career guidance"] },
  { name: "Annual pass", price: "₹1,999", per: "per year", cost: () => 1999, features: ["Unlimited courses", "VIP support access", "Certificate of completion", "Career guidance", "Competition preparation"] },
];

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* Three plans as one radio group, plus a slider for how many courses a child takes in a year. Each card shows what that
   many courses cost on that plan (single courses are per course, the semester plan covers 2 courses per semester, the
   annual pass is flat) and the cheapest is marked. The selection follows the cheapest until a card is picked by hand, so
   the line below always names what the button starts. */
export default function ParentsPlans() {
  const [n, setN] = useState(2);
  const [chosen, setChosen] = useState<number | null>(null);

  // On phones the plans are a swipeable row: slide the selected one into view (sideways only, never the page)
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(".pr-plans");
    const card = row?.querySelector<HTMLElement>('.pr-plan[data-on="true"]');
    if (!row || !card || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: card.offsetLeft - 20, behavior: "smooth" });
  }, [n, chosen]);
  const totals = PLANS.map((p) => p.cost(n));
  const best = totals.indexOf(Math.min(...totals));
  const sel = chosen ?? best;
  const cur = PLANS[sel];
  const top = Math.max(...totals);
  return (
    <div>
      <div className="pr-count">
        <label htmlFor="pr-n">How many courses will your child take in a year?</label>
        <div className="pr-count-row">
          <input
            id="pr-n" type="range" min={1} max={8} value={n}
            style={{ "--p": `${((n - 1) / 7) * 100}%` } as React.CSSProperties}
            onChange={(e) => setN(Number(e.target.value))}
          />
          <output htmlFor="pr-n" aria-live="polite"><b>{n}</b> {n === 1 ? "course" : "courses"}</output>
        </div>
      </div>
      <div className="pr-plans" role="radiogroup" aria-label="Plans">
        {PLANS.map((p, i) => (
          <label key={p.name} className="pr-plan" data-on={sel === i} data-best={best === i}>
            <input type="radio" name="plan" className="sr-only" checked={sel === i} onChange={() => setChosen(i)} />
            {p.popular && <em className="pr-plan-flag">Most popular</em>}
            <h3>{p.name}</h3>
            <p className="pr-plan-price"><strong>{p.price}</strong><span>{p.per}</span></p>
            <div className="pr-cost">
              <p><span>For {n} {n === 1 ? "course" : "courses"}</span><b>{rupees(totals[i])}</b></p>
              <div className="pr-cost-bar" aria-hidden="true"><i style={{ transform: `scaleX(${totals[i] / top})` }} /></div>
              <small>{best === i ? "Lowest cost for this many" : `${rupees(totals[i] - totals[best])} more`}</small>
            </div>
            <ul>
              {p.features.map((f) => (
                <li key={f}><span className="rh-chip-ico"><Check size={12} aria-hidden="true" /></span>{f}</li>
              ))}
            </ul>
          </label>
        ))}
      </div>
      <div className="pr-plans-go">
        <p aria-live="polite">You picked the <b>{cur.name}</b>: {rupees(totals[sel])} for {n} {n === 1 ? "course" : "courses"}.</p>
        <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--primary">Start the {cur.name.toLowerCase()}</Link>
      </div>
    </div>
  );
}
