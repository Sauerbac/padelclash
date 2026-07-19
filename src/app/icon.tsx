import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

// Manifest icons (192 / 512 / maskable) rasterized at build time from the
// logo SVG in public/ — no binary assets in the repo. URLs are /icon/<id>,
// referenced from app/manifest.ts.
export function generateImageMetadata() {
  return [
    { id: "192", contentType: "image/png", size: { width: 192, height: 192 } },
    { id: "512", contentType: "image/png", size: { width: 512, height: 512 } },
    {
      id: "maskable",
      contentType: "image/png",
      size: { width: 512, height: 512 },
    },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const resolved = await id;
  const size = resolved === "192" ? 192 : 512;
  // Maskable: the OS crops an arbitrary shape, so keep the mark inside the
  // central safe zone on a full-bleed background instead of edge to edge.
  const maskable = resolved === "maskable";
  const logo = await logoDataUri(maskable ? "transparent" : "tile");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16110d",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori JSX, not the DOM */}
        <img
          src={logo}
          alt=""
          width={maskable ? size * 0.72 : size}
          height={maskable ? size * 0.72 : size}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
