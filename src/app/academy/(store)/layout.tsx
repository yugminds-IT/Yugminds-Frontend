import { AcademyFooter, AcademyHeader } from "@/components/academy/AcademyHeader";

/** Public storefront chrome (dashboards under /academy/{learn,tutor,admin} have their own). */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ac-ink">
      <AcademyHeader />
      <main className="flex-1">{children}</main>
      <AcademyFooter />
    </div>
  );
}
