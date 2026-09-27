import type { Metadata, Viewport } from "next";
import { ABeeZee } from "next/font/google";
import "./globals.css";
import QueryProvider from "../components/providers/QueryProvider";
import SuppressPromiseWarnings from "../components/SuppressPromiseWarnings";
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
  if (brand !== "yugminds") {
    return {
      metadataBase: await metadataBaseForRequest(),
      icons: {
        icon: [
          { url: "/icon.png", type: "image/png", sizes: "32x32" },
          { url: "/favicon.ico", sizes: "any" },
        ],
        apple: "/apple-icon.png",
      },
    };
  }
  const meta = await buildBrandMetadata("yugminds", pathname === "/" ? "/" : pathname);
  return {
    ...meta,
    icons: {
      icon: [
        { url: "/icon.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: "/apple-icon.png",
    },
  };
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
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
