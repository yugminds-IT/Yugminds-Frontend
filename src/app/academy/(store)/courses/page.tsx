import { fetchCatalog } from "@/components/academy/catalog";
import { ProductCard } from "@/components/academy/ProductCard";
import type { Product } from "@/lib/academy/api";

export const revalidate = 300;

export default async function CoursesPage() {
  const products = await fetchCatalog<Product[]>("/academy/products", []);
  const courses = products.filter((p) => p.type === "COURSE");
  const packs = products.filter((p) => p.type === "SESSION_PACK");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-acdisplay font-bold">Courses</h1>
      <p className="mt-2 text-ac-muted">Self-paced courses you can start today, and live 1:1 class packs.</p>

      {products.length === 0 && (
        <p className="mt-12 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-ac-muted">
          New courses are coming soon. Check back shortly!
        </p>
      )}

      {courses.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {packs.length > 0 && (
        <>
          <h2 className="mt-14 text-2xl font-acdisplay font-bold">Live 1:1 class packs</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
