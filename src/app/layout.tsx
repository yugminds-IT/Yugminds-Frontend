import type { Metadata, Viewport } from "next";
import { ABeeZee } from "next/font/google";
import "./globals.css";
import QueryProvider from "../components/providers/QueryProvider";
import SuppressPromiseWarnings from "../components/SuppressPromiseWarnings";
import PageViewTracker from "../components/PageViewTracker";
import { StructuredData } from "../components/StructuredData";
import {
  buildBrandMetadata,
  metadataBaseForRequest,
  readInternalPathname,
  resolveRequestBrand,
} from "../lib/brand-metadata";

const abeezee = ABeeZee({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-abeezee",
  display: "swap",
  preload: true,
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveRequestBrand();
  const pathname = await readInternalPathname();
  // Icons come from src/app/favicon.ico, icon.png (192px) and apple-icon.png.
  if (brand !== "yugminds") {
    return { metadataBase: await metadataBaseForRequest() };
  }
  return buildBrandMetadata("yugminds", pathname === "/" ? "/" : pathname);
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${abeezee.variable} font-abeezee antialiased`}
        suppressHydrationWarning
      >
        <StructuredData />
        <SuppressPromiseWarnings />
        <PageViewTracker />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
