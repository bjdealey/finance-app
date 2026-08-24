import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages must be loaded from node_modules at runtime, not bundled,
  // or their asset/worker paths break (pglite WASM, pg, argon2 .node binary).
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@node-rs/argon2"],
};

export default nextConfig;
