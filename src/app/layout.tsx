import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { BASE_PATH } from "@/lib/basePath";

export const metadata: Metadata = {
  title: "mise",
  description:
    "mise en place — Gekochtes festhalten, Zutaten sammeln, alles am Platz.",
  // Next does not prefix these with basePath, so do it here.
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: "mise",
    // "default" keeps the dark status-bar glyphs the light glass UI needs.
    statusBarStyle: "default",
  },
  icons: {
    icon: `${BASE_PATH}/icon-192.png`,
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F3F5",
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report real values on iPhone.
  viewportFit: "cover",
  // The app is a fixed-height shell; zooming would break the sticky chrome.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
