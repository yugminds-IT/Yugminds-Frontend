"use client";

import { useEffect, useState } from "react";
import { CountUp } from "@/components/ui/count-up";

export default function FooterVisitCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/visits")
      .then((r) => r.json())
      .then((d: { count: number | null }) => setCount(d.count))
      .catch(() => {});
  }, []);

  if (count === null) return null;

  return (
    <div>
      <div className="font-semibold text-xl mb-3 text-white">Users Count</div>
      <CountUp
        to={count}
        separator=","
        digitEffect="slide"
        className="text-4xl font-bold tabular-nums tracking-tight text-white"
      />
      <div className="text-sm text-gray-400 mt-1">total visits</div>
    </div>
  );
}
