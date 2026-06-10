import { SITE_META, resolveSiteUrl } from "@osaja/config";
import type { MetadataRoute } from "next";

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, SITE_META.landing.defaultUrl);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
