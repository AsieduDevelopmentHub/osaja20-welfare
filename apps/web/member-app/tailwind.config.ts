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
          /* legacy scale mapped to logo navy */
          50: "#eef4fc",
          100: "#d9e6f7",
          200: "#b3cdf0",
          300: "#7eb8e8",
          400: "#5a9fd4",
          500: "#2b6cb0",
          600: "#0a2d6e",
          700: "#061d47",
          800: "#051838",
          900: "#031025",
        },
        accent: {
          gold: "#c9a227",
          green: "#2d8a5e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(10, 45, 110, 0.08)",
        card: "0 4px 24px rgba(10, 45, 110, 0.12)",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
