import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: {
            DEFAULT: "#0a2d6e",
            light: "#1e4a8c",
            dark: "#061d47",
          },
          blue: {
            DEFAULT: "#2b6cb0",
            light: "#5a9fd4",
            sky: "#7eb8e8",
          },
          gold: {
            DEFAULT: "#c9a227",
            light: "#e4c04a",
            dark: "#9a7b1a",
          },
          cream: "#faf8f5",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(10, 45, 110, 0.08)",
        card: "0 4px 24px rgba(10, 45, 110, 0.12)",
        hero: "0 24px 64px rgba(6, 29, 71, 0.18)",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
