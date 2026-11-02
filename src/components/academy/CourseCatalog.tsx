"use client";

import { useState } from "react";
import type { Product } from "@/lib/academy/api";
import { ProductRow } from "./ProductCard";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "course", label: "Self-paced courses", test: (p: Product) => p.type === "COURSE" },
  { id: "pack", label: "Live 1:1 classes", test: (p: Product) => p.type === "SESSION_PACK" },
  { id: "free", label: "Free", test: (p: Product) => p.priceInPaise === 0 },
] as const;

/* The full catalogue with a type filter. Only filters that have something in them are shown. */
export function Catalog({ products }: { products: Product[] }) {
  const [id, setId] = useState<(typeof FILTERS)[number]["id"]>("all");
  const filters = FILTERS.filter((f) => f.id === "all" || products.some(f.test));
  const shown = products.filter(FILTERS.find((f) => f.id === id)!.test);

  return (
    <>
      {filters.length > 2 && (
        <div className="ac-filters" role="group" aria-label="Filter the catalogue">
          {filters.map((f) => (
            <button key={f.id} type="button" aria-pressed={id === f.id} onClick={() => setId(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      <div className="ac-list">
        {shown.map((p) => <ProductRow key={p.id} product={p} />)}
      </div>
    </>
  );
}
