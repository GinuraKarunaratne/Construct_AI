import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Untitled UI-style primary scale — near-black for CTAs
        brand: {
          50:  "#F9FAFB",
          100: "#F2F4F7",
          200: "#EAECF0",
          300: "#D0D5DD",
          400: "#98A2B3",
          500: "#475467",
          600: "#101828",   // Primary CTA
          700: "#1D2939",   // CTA hover
          800: "#101828",
          900: "#0C111D",
        },
        // Neutral surface system (Untitled UI grays)
        surface: {
          bg:      "#FAFAFA",   // Page background
          card:    "#FFFFFF",   // Card / panel
          subtle:  "#F9FAFB",   // Hover, raised
          border:  "#EAECF0",   // Card border
          divider: "#F2F4F7",   // Hairline divider
        },
        // Text scale
        ink: {
          900: "#101828",   // Primary text
          700: "#344054",
          600: "#475467",   // Secondary text
          500: "#667085",   // Tertiary text
          400: "#98A2B3",   // Muted text
          300: "#D0D5DD",   // Disabled
        },
        // Status colors (Untitled UI palette)
        success: {
          50:  "#ECFDF3",
          100: "#D1FADF",
          500: "#12B76A",
          600: "#039855",
          700: "#027A48",
        },
        warning: {
          50:  "#FFFAEB",
          100: "#FEF0C7",
          500: "#F79009",
          600: "#DC6803",
          700: "#B54708",
        },
        danger: {
          50:  "#FEF3F2",
          100: "#FEE4E2",
          500: "#F04438",
          600: "#D92D20",
          700: "#B42318",
        },
        info: {
          50:  "#EFF8FF",
          100: "#D1E9FF",
          500: "#2E90FA",
          600: "#1570EF",
          700: "#175CD3",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Untitled UI display sizes
        "display-xs": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em" }],
        "display-sm": ["30px", { lineHeight: "38px", letterSpacing: "-0.015em" }],
        "display-md": ["36px", { lineHeight: "44px", letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [],
};

export default config;
