import Toaster from "@/components/Toaster";

export const dynamic = "force-dynamic";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <><Toaster />{children}</>;
}
