import { ImageResponse } from "next/og";
import { AppIconMark } from "@/components/app-icon-mark";

// iOS home-screen icon (apple-touch-icon). iOS squares off transparent
// corners itself; the mark's full-bleed background is what we want here.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconMark size={size.width} />, size);
}
