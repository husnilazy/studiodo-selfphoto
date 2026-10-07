import Toaster from "@/components/Toaster";
import { GOOGLE_FONTS } from "@/lib/editor/types";

export const dynamic = "force-dynamic";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${GOOGLE_FONTS}&display=swap`} />
      <Toaster />
      {children}
    </>
  );
}
