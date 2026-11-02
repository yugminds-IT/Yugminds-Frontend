"use client";

import { useEffect, useState } from "react";

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
    <div className="rf-visits">
      <strong className="rf-visits-n">{count.toLocaleString("en-IN")}</strong>
      <span>total visits</span>
    </div>
  );
}
