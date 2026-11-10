import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { STORE_DESCRIPTION } from "@/lib/brand";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";
import { THEME_SCRIPT } from "@/components/theme/theme-script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "AppDrop";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  openGraph: { siteName, type: "website" },
  twitter: { card: "summary_large_image" },
  title: { default: siteName, template: `%s · ${siteName}` },
  description: STORE_DESCRIPTION,
  applicationName: siteName,
  appleWebApp: { capable: true, title: siteName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false }, // personal store — keep out of search engines
  icons: {
    icon: [{ url: "/icons/favicon", type: "image/png" }],
    apple: [{ url: "/icons/apple", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by THEME_SCRIPT before hydration, hence suppressHydrationWarning.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
