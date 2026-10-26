import { Chakra_Petch } from "next/font/google";

/**
 * Squared, engineered display face shared by the YugMinds site and the
 * Academy (headings, numbers). Body text stays ABeeZee site-wide.
 * Apply `displayFont.variable` on a wrapper; use the `font-acdisplay` utility.
 */
export const displayFont = Chakra_Petch({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ac-display",
  display: "swap",
});
