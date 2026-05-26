import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9"
        },
        ink: "#0f172a",
        graphite: "#475569"
      },
      boxShadow: {
        line: "0 1px 2px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
