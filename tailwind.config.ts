import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  // hover: styles only where the device can really hover, so a tap doesn't leave them stuck on phones.
  future: { hoverOnlyWhenSupported: true },
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/store/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-abeezee)', 'sans-serif'],
        abeezee: ['var(--font-abeezee)', 'sans-serif'],
        // Academy headings, prices and progress numbers (loaded in app/academy/layout.tsx).
        acdisplay: ['var(--font-ac-display)', 'var(--font-abeezee)', 'sans-serif'],
      },
      colors: {
        /* Public landing page palette — blue / white / black only, no
           accent color. "blue-soft" is the same brand blue family, just
           light enough to stay visible where the background is already
           mid-blue (hero, preloader, numbers band) — not a second hue. */
        ym: {
          cream: "#FFFFFF",
          sand: "#F8FAFC",
          ink: "#020617",
          text: "#0F172A",
          muted: "#64748B",
          blue: "#2563EB",
          "blue-deep": "#172554",
          "blue-lit": "#1D4ED8",
          "blue-soft": "#93C5FD",
        },
        // Academy — same palette as RoboCoders / LMS / YugMinds: blue-600 primary,
        // blue-700 hover, blue-50 tint, slate ink, amber accent.
        ac: {
          brand: "#2563EB",
          "brand-dark": "#1D4ED8",
          soft: "#EFF6FF",
          ink: "#0F172A",
          muted: "#64748B",
          accent: "#F59E0B",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [typography],
};

export default config;

