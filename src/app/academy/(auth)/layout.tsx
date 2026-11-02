import { AuthLayout } from "@/components/academy/AuthLayout";

/** Login / signup / forgot password: the RoboCoders-styled split layout (no footer). */
export default function AcademyAuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
