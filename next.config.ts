import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-host as a single Docker container on Coolify (ADR-0010).
  output: "standalone",
};

export default nextConfig;
