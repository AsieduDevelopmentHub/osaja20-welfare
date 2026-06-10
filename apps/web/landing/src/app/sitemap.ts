import { SITE_META, resolveSiteUrl } from "@osaja/config";
import type { MetadataRoute } from "next";

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, SITE_META.landing.defaultUrl);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
