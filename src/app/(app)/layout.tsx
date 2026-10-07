import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getStudio } from "@/lib/data";
import { getSiteConfig } from "@/lib/siteServer";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, studio, site] = await Promise.all([requireUser(), getStudio(), getSiteConfig()]);
  const b = site.brand;
  // Logo admin = logo yang diunggah untuk website (Website → Brand).
  const brand = { name: studio.name, logo: b.logo_url, logoDark: b.logo_dark_url, height: b.logo_height, text: b.text, textSize: b.text_size, textFont: b.text_font };
  return <AppShell user={{ name: user.name, role: user.role }} brand={brand}>{children}</AppShell>;
}
