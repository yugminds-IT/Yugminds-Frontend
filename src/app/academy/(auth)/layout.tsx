import { AcademyHeader } from "@/components/academy/AcademyHeader";
import { AuthLayout } from "@/components/academy/AuthLayout";

/** Login / signup / forgot password: Academy header + split hero layout (no footer). */
export default function AcademyAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-ac-ink">
      <AcademyHeader />
      <AuthLayout>{children}</AuthLayout>
    </div>
  );
}
