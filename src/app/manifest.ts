import type { MetadataRoute } from "next";

// Web app manifest (spec "PWA & offline"): installable, standalone display.
// Icons are the build-time-generated routes from app/icon.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PadelClash",
    short_name: "PadelClash",
    description: "Padel match tracker for the circle",
    start_url: "/",
    display: "standalone",
    background_color: "#16110d",
    theme_color: "#16110d",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      {
        src: "/icon/maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
