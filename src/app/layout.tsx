import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: { default: "STUDIODO Kasir", template: "%s · STUDIODO Kasir" },
  description: "Kasir, booking, customer, dan keuangan untuk STUDIODO self photo studio.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "STUDIODO", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth" className={`${jakarta.variable} ${sora.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Script id="sd-theme" strategy="beforeInteractive">{`try{var t=localStorage.getItem("sd_theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`}</Script>
        {children}
      </body>
    </html>
  );
}
