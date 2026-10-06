import { ImageResponse } from "next/og";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#4f4fe8", color: "#fff", fontSize: size * 0.46, fontWeight: 800, letterSpacing: -size * 0.02 }}>
        SD
      </div>
    ),
    { width: size, height: size },
  );
}
