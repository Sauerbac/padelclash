import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // The UI state gallery frames its own case routes at phone widths
        // (decision 128), and `DENY` above blocks that even same-origin. This
        // relaxes it to `SAMEORIGIN` for `/dev/*` only — a subtree that
        // `notFound()`s outside development, so in production these paths have
        // nothing to frame.
        source: "/dev/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        source: "/join/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Browsers must always revalidate the service worker, or a stale one
        // keeps serving a previous deploy's shell.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
