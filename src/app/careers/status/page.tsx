import type { Metadata } from "next";
import { YugmindsShell } from "@/components/yugminds/YugmindsSite";
import CareersStatus from "@/components/yugminds/CareersStatus";

export const metadata: Metadata = { title: "Check your application | YugMinds Careers", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <YugmindsShell>
      <CareersStatus initialRef={typeof ref === "string" ? ref.slice(0, 20) : ""} />
    </YugmindsShell>
  );
}
