/** Brand colors extracted from OSAJA'20 welfare & batch logos */

export const BRAND = {
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
  white: "#ffffff",
  cream: "#faf8f5",
} as const;

export const BRAND_PATHS = {
  welfareLogo: "/brand/welfare-logo.jpg",
  batchLogo: "/brand/batch-logo.jpg",
} as const;

export const BRAND_COPY = {
  name: "OSAJA'20",
  welfare: "Welfare",
  tagline: "Caring • Supporting • Uplifting",
  batch: "Asuofua D/A JHS Block A Batch 2020",
  motto: "One School | One Family | Forever Connected",
} as const;
