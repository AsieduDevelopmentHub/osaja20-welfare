import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { ServiceWorkerInit } from "@/components/ServiceWorkerInit";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "OSAJA'20 Welfare — Member Portal",
  description: "Asuofua D/A JHS Block A Batch 2020 Welfare Platform",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "OSAJA'20",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2d6e",
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
