import { redirect } from "next/navigation";

// Old links: /careers/apply?role=<slug>
export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  redirect(typeof role === "string" && role ? `/careers/${encodeURIComponent(role)}/apply` : "/#careers");
}
