import Link from "next/link";
import { ArrowUpRight, BookOpen, Video } from "lucide-react";
import { formatINR, type Product } from "@/lib/academy/api";

export function Price({ product, large = false }: { product: Pick<Product, "priceInPaise" | "mrpInPaise">; large?: boolean }) {
  const free = product.priceInPaise === 0;
  const off =
    product.mrpInPaise && product.mrpInPaise > product.priceInPaise
      ? Math.round((1 - product.priceInPaise / product.mrpInPaise) * 100)
      : 0;
  return (
    <span className="ac-price-wrap" style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.2rem 0.6rem" }}>
      {free ? <span className="ac-free">Free</span> : <span className={`ac-price${large ? " ac-price--lg" : ""}`}>{formatINR(product.priceInPaise)}</span>}
      {off > 0 && (
        <>
          <span className="ac-mrp">{formatINR(product.mrpInPaise!)}</span>
          <span className="ac-save">save {off}%</span>
        </>
      )}
    </span>
  );
}

export function kindLabel(p: Pick<Product, "type" | "priceInPaise" | "sessionCount" | "sessionMinutes">) {
  if (p.type === "COURSE") return p.priceInPaise === 0 ? "Free demo course" : "Self-paced course";
  return p.priceInPaise === 0
    ? `Free ${p.sessionMinutes}-minute trial class`
    : `${p.sessionCount} live 1:1 classes, ${p.sessionMinutes} minutes each`;
}

/** A catalogue entry as a ruled row: art tile, title and line of detail, price at the end. */
export function ProductRow({ product }: { product: Product }) {
  const Icon = product.type === "COURSE" ? BookOpen : Video;
  return (
    <Link href={`/academy/courses/${product.slug}`} className="ac-row">
      <span className="ac-art">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-provided URL, may be any host
          <img src={product.thumbnailUrl} alt="" />
        ) : (
          <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <span>
        <span className="ac-row-title">{product.title}</span>
        <span className="ac-row-meta" style={{ display: "block" }}>{kindLabel(product)}</span>
      </span>
      <span className="ac-row-end">
        <Price product={product} />
        <ArrowUpRight size={18} aria-hidden="true" />
      </span>
    </Link>
  );
}
