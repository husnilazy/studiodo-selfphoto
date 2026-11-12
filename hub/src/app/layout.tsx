import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Frameless Hub", template: "%s · Frameless Hub" },
  description: "Pusat keuangan, alokasi, dan keputusan seluruh perusahaan Frameless.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hub", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg", apple: [{ url: "/pwa/180", sizes: "180x180" }] },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#050608" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Script id="fh-theme" strategy="beforeInteractive">{`try{var t=localStorage.getItem("fh_theme");if(t==="light")document.documentElement.dataset.theme="light";if(localStorage.getItem("fh_hide")==="1"||(!sessionStorage.getItem("fh_started")&&localStorage.getItem("fh_hide_def")!=="0"))document.documentElement.dataset.privacy="hidden"}catch(e){}`}</Script>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
