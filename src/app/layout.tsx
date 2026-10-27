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
  // Paint under the notch; fixed bars pad themselves back out with env(safe-area-inset-*).
  viewportFit: "cover",
  // Android: the keyboard shrinks the layout, so the brief form and bot panel stay reachable.
  interactiveWidget: "resizes-content",
  // Browser chrome matches the white header in both OS schemes (the sites have no OS-driven dark mode).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No `scroll-smooth` here: scroll-behavior: smooth on <html> leaks into native touch-driven
  // scrolling on WebKit (Safari and every iOS browser, which are all WebKit under the hood),
  // causing visible jitter on every scroll, not just anchor jumps. See globals.css for the same
  // reasoning — this was a second, site-wide copy of the same bug this app's jumpTo() helper
  // already works around with an explicit `behavior: "smooth"` per call.
  return (
    <html lang="en" suppressHydrationWarning>
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
