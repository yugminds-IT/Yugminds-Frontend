import { fetchCatalog } from "@/components/academy/catalog";
import { Catalog } from "@/components/academy/CourseCatalog";
import type { Product } from "@/lib/academy/api";

export const revalidate = 300;

export default async function CoursesPage() {
  const products = await fetchCatalog<Product[]>("/academy/products", []);

  return (
    <section className="ac-top ac-page" aria-labelledby="ac-courses-h">
      <div className="rh-wrap">
        <div className="ac-pagehead">
          <h1 id="ac-courses-h" style={{ fontSize: "var(--rh-t-h2)", maxWidth: "16ch" }}>Courses and classes</h1>
          <p className="rh-lede">Self-paced courses you can start today, and live 1:1 class packs with a tutor.</p>
        </div>
        {products.length === 0 ? (
          <div className="ac-empty">
            <b>New courses are on the way</b>
            <p>Take lesson one on the home page while you wait.</p>
            <a href="/academy" className="rh-btn rh-btn--primary">Try lesson one</a>
          </div>
        ) : (
          <Catalog products={products} />
        )}
      </div>
    </section>
  );
}
