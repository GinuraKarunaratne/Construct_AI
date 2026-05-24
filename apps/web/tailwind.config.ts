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
        // Construction-inspired orange accent
        brand: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",  // Primary CTA
          700: "#c2410c",  // Hover
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Warm neutral surface system
        surface: {
          bg:     "#fafaf9",  // Page background (stone-50)
          card:   "#ffffff",  // Card / panel
          raised: "#f5f4f2",  // Slightly elevated (table header)
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
