import { BRAND_COPY, BRAND_PATHS } from "./brand.js";

/** Public site URL for absolute OG/Twitter image URLs (pass NEXT_PUBLIC_SITE_URL from the app). */
export function resolveSiteUrl(envUrl: string | undefined, portFallback: string): string {
  const trimmed = envUrl?.trim().replace(/\/$/, "");
  return trimmed || portFallback;
}

export const SITE_META = {
  member: {
    favicon: BRAND_PATHS.welfareLogo,
    ogImage: BRAND_PATHS.welfareLogo,
    ogImageAlt: `${BRAND_COPY.name} ${BRAND_COPY.welfare} logo`,
    title: `${BRAND_COPY.name} ${BRAND_COPY.welfare} — Member Portal`,
    description: `${BRAND_COPY.batch} — ${BRAND_COPY.tagline}`,
    siteName: `${BRAND_COPY.name} ${BRAND_COPY.welfare}`,
    defaultUrl: "http://localhost:3000",
  },
  admin: {
    favicon: BRAND_PATHS.batchLogo,
    ogImage: BRAND_PATHS.batchLogo,
    ogImageAlt: `${BRAND_COPY.batch} logo`,
    title: `${BRAND_COPY.name} ${BRAND_COPY.welfare} — Admin Portal`,
    description: `Executive administration for ${BRAND_COPY.name} ${BRAND_COPY.welfare}`,
    siteName: `${BRAND_COPY.name} Admin`,
    defaultUrl: "http://localhost:3001",
  },
} as const;
