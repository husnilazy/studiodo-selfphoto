"use client";
import ErrorView from "@/components/ErrorView";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView error={error} retry={retry} home="/dashboard" compact />;
}
