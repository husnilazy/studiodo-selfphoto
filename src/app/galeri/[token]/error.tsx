"use client";
import ErrorView from "@/components/ErrorView";

export default function GalleryError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="gal min-h-dvh"><ErrorView error={error} retry={retry} home="/galeri" /></div>;
}
