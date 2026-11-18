import { YugmindsShell } from "@/components/yugminds/YugmindsSite";
import CareersApply from "@/components/yugminds/CareersApply";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <YugmindsShell>
      <CareersApply slug={slug} />
    </YugmindsShell>
  );
}
