import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND, SITE_META, resolveSiteUrl } from "@osaja/config";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { ServiceWorkerInit } from "@/components/ServiceWorkerInit";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const meta = SITE_META.member;
const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, meta.defaultUrl);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: meta.title,
    template: `%s | ${meta.siteName}`,
  },
  description: meta.description,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: meta.siteName,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: siteUrl,
    siteName: meta.siteName,
    title: meta.title,
    description: meta.description,
    images: [
      {
        url: meta.ogImage,
        alt: meta.ogImageAlt,
      },
    ],
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
        <AuthProvider>
          <ServiceWorkerInit />
          {children}
          <PwaInstallBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
