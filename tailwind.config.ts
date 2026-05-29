import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#020617",
        panel: "#0f172a",
        accent: "#22d3ee",
        signal: "#f59e0b",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        ambient: "0 25px 90px rgba(8, 15, 32, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
