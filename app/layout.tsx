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

const THEME_INIT_SCRIPT = `(function(){try{var tm={light:[0,"#ffffff"],sepia:[0,"#fdfaf3"],sage:[0,"#fafdf8"],breeze:[0,"#fbfdff"],dark:[1,"#0f172a"],forest:[1,"#0b1f16"],ocean:[1,"#0a192f"],dusk:[1,"#181024"],amoled:[1,"#000000"]};var ac={"sk-green":1,blue:1,teal:1,violet:1,amber:1,rose:1};var t=localStorage.getItem("sk_tocok_theme");var a=localStorage.getItem("sk_tocok_accent");var s=(t&&tm[t])?t:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var acc=(a&&ac[a])?a:"sk-green";var isD=tm[s][0]===1;var r=document.documentElement;r.dataset.theme=s;r.dataset.accent=acc;r.classList.toggle("dark",isD);r.style.colorScheme=isD?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m);}m.content=tm[s][1];}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex flex-col min-h-screen antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
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
