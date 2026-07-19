import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

// iOS home-screen icon (apple-touch-icon). iOS squares off transparent
// corners itself; the logo tile's full-bleed background is what we want.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await logoDataUri("tile");
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- satori JSX, not the DOM
      <img src={logo} alt="" width={size.width} height={size.height} />
    ),
    size,
  );
}
