import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin workspace root when multiple lockfiles exist above this directory (silences Turbopack warning).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
