import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import PreventZoom from "@/components/PreventZoom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SK Tocok Portal | Sangguniang Kabataan ng Barangay Tocok",
  description: "Official public transparency and youth services portal of Sangguniang Kabataan ng Barangay Tocok, San Fabian, Pangasinan. Track financial allocations and submit school printing requests.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SK Tocok",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="flex flex-col min-h-screen antialiased font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <AuthProvider>
          <ThemeProvider>
            <PreventZoom />
            <Header />
            <main className="flex-1 min-h-[calc(100vh-58px)] md:min-h-[calc(100vh-110px)] min-h-[calc(100dvh-58px)] md:min-h-[calc(100dvh-110px)]">{children}</main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
