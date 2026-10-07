import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Caveat, Playfair_Display, Plus_Jakarta_Sans, Sora, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
// Font tambahan untuk teks brand (CMS): tidak diunduh kecuali dipakai.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", preload: false });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", preload: false });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", preload: false });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", preload: false });

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
    <html lang="id" data-scroll-behavior="smooth" className={`${jakarta.variable} ${sora.variable} ${playfair.variable} ${space.variable} ${bebas.variable} ${caveat.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Script id="sd-theme" strategy="beforeInteractive">{`try{var t=localStorage.getItem("sd_theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`}</Script>
        {children}
      </body>
    </html>
  );
}
