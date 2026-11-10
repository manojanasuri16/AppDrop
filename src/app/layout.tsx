import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/ServiceWorker";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "AppDrop";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s · ${siteName}` },
  description: "Apps made by a friend — download Android apps and open web apps, straight from the source.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
