import { Bricolage_Grotesque, Figtree } from "next/font/google";

// Shared by the home page and its navbar, so both set type in the same two families.
export const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-rh-display", display: "swap" });
export const body = Figtree({ subsets: ["latin"], variable: "--font-rh-body", display: "swap" });
