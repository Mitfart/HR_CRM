import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:   "#2f4366",   // header, primary bg
          gold:   "#ffc732",   // primary CTA button
          green:  "#2e7f30",   // secondary CTA button
          dark:   "#333438",   // main text
          light:  "#ebeef3",   // section backgrounds
          "navy-dark": "#243350",
          "gold-hover": "#e6b000",
        },
      },
      fontFamily: {
        sans: ["Arial", "Helvetica Neue", "sans-serif"],
      },
      borderRadius: {
        "xl2": "1.25rem",  // 20px
      },
      boxShadow: {
        card: "0 0 15px rgba(51,52,56,0.10)",
        cta:  "0 4px 20px rgba(255,199,50,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
