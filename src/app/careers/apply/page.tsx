import { redirect } from "next/navigation";
import { YugmindsShell } from "@/components/yugminds/YugmindsSite";
import CareersApply from "@/components/yugminds/CareersApply";

export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  if (typeof role !== "string" || !role) redirect("/#careers");
  return (
    <YugmindsShell>
      <CareersApply slug={role} />
    </YugmindsShell>
  );
}
