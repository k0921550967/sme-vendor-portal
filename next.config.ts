import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 15 將此選項從 experimental 移至頂層
  serverExternalPackages: ["googleapis", "bcryptjs", "google-auth-library", "gcp-metadata", "google-logging-utils"],

  webpack: (config, { isServer, webpack }) => {
    // Strip "node:" URI prefix so Webpack can resolve built-ins (e.g. node:process → process)
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        process: false,
        buffer: false,
        crypto: false,
        stream: false,
        path: false,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
