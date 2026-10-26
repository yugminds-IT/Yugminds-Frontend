import Link from "next/link";
import { BookOpen, Video } from "lucide-react";
import { formatINR, type Product } from "@/lib/academy/api";

export function Price({ product, large = false }: { product: Pick<Product, "priceInPaise" | "mrpInPaise">; large?: boolean }) {
  const free = product.priceInPaise === 0;
  const off =
    product.mrpInPaise && product.mrpInPaise > product.priceInPaise
      ? Math.round((1 - product.priceInPaise / product.mrpInPaise) * 100)
      : 0;
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`font-acdisplay font-semibold ${free ? "text-amber-600" : "text-ac-ink"} ${large ? "text-4xl" : "text-xl"}`}>
        {free ? "Free" : formatINR(product.priceInPaise)}
      </span>
      {off > 0 && (
        <>
          <span className="text-sm text-slate-400 line-through">{formatINR(product.mrpInPaise!)}</span>
          <span className="text-xs font-semibold text-slate-600">save {off}%</span>
        </>
      )}
    </div>
  );
}

export function kindLabel(p: Pick<Product, "type" | "priceInPaise" | "sessionCount" | "sessionMinutes">) {
  if (p.type === "COURSE") return p.priceInPaise === 0 ? "Free demo course" : "Self-paced course";
  return p.priceInPaise === 0
    ? `Free ${p.sessionMinutes}-minute trial class`
    : `${p.sessionCount} live 1:1 classes, ${p.sessionMinutes} minutes each`;
}

export function ProductCard({ product }: { product: Product }) {
  const isCourse = product.type === "COURSE";
  const free = product.priceInPaise === 0;
  return (
    <Link
      href={`/academy/courses/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white outline-none transition-colors hover:border-ac-brand focus-visible:ring-2 focus-visible:ring-ac-brand/40"
    >
      <div className="relative aspect-[16/9] border-b border-slate-200">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-provided URL, may be any host
          <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="ac-graph flex h-full items-center justify-center text-ac-brand">
            {isCourse ? <BookOpen className="h-10 w-10" strokeWidth={1.5} /> : <Video className="h-10 w-10" strokeWidth={1.5} />}
          </div>
        )}
        {free && <span className="absolute left-3 top-3 rounded-md bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">Free</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm text-slate-500">{kindLabel(product)}</p>
        <h3 className="mt-1 font-acdisplay text-lg font-semibold leading-snug text-ac-ink group-hover:text-ac-brand">{product.title}</h3>
        {product.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.description}</p>}
        <div className="mt-auto pt-5">
          <Price product={product} />
        </div>
      </div>
    </Link>
  );
}
