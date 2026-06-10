import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND, SITE_META, resolveSiteUrl } from "@osaja/config";
import { AosInit } from "@/components/AosInit";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const meta = SITE_META.landing;
const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, meta.defaultUrl);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: meta.title,
    template: `%s | ${meta.siteName}`,
  },
  description: meta.description,
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/brand/welfare-logo.jpg", type: "image/jpeg" }],
    apple: [{ url: "/brand/welfare-logo.jpg", type: "image/jpeg" }],
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: siteUrl,
    siteName: meta.siteName,
    title: meta.title,
    description: meta.description,
    images: [{ url: meta.ogImage, alt: meta.ogImageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: meta.title,
    description: meta.description,
    images: [meta.ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: BRAND.navy.DEFAULT,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AosInit />
        {children}
      </body>
    </html>
  );
}
