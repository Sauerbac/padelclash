import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The PadelClash logo SVGs from public/, as data URIs for satori
 * (next/og ImageResponse) — it can rasterize <img> sources but not fetch
 * relative URLs. Server-only (fs).
 *
 * "tile" is the full-bleed variant with the baked-in #16110D background;
 * "transparent" is the bare mark for compositing (e.g. the maskable icon's
 * safe zone).
 */
export async function logoDataUri(
  variant: "tile" | "transparent",
): Promise<string> {
  const file = variant === "tile" ? "logo-tile.svg" : "logo.svg";
  const svg = await readFile(path.join(process.cwd(), "public", file));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}
