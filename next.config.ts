import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Zerops (and any Docker/container) deployment.
  // Produces a self-contained .next/standalone directory that includes
  // all server-side dependencies — no separate node_modules needed at runtime.
  output: "standalone",
};

export default nextConfig;
