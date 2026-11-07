import CertVerify from "@/components/public/CertVerify";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  return <CertVerify initialCode={decodeURIComponent(shortId)} />;
}
