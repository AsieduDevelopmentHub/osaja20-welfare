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
          },
          gold: {
            DEFAULT: "#c9a227",
            light: "#e4c04a",
            dark: "#9a7b1a",
          },
          cream: "#faf8f5",
          600: "#0a2d6e",
          700: "#061d47",
        },
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.25)",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
