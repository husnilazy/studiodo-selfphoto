import { ImageResponse } from "next/og";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const s = Math.min(512, Math.max(64, Number((await params).size) || 192));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#050608", color: "#ffffff", fontSize: s * 0.58, fontWeight: 800 }}>
        F
      </div>
    ),
    { width: s, height: s },
  );
}
