import { ImageResponse } from "next/og";
import { AppIconMark } from "@/components/app-icon-mark";

// Manifest icons (192 / 512 / maskable) generated at build time from the one
// mark — no binary assets in the repo. URLs are /icon/<id>, referenced from
// app/manifest.ts.
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
  const size = (await id) === "192" ? 192 : 512;
  return new ImageResponse(<AppIconMark size={size} />, {
    width: size,
    height: size,
  });
}
