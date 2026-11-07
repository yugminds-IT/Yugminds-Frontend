import { Bricolage_Grotesque, Figtree } from "next/font/google";

// The two typefaces of the portal design system. Declared once so every dashboard shell shares them.
export const portalDisplay = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-sd-display", display: "swap" });
export const portalBody = Figtree({ subsets: ["latin"], variable: "--font-sd-body", display: "swap" });
