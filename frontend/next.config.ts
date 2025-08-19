import NextBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

// Get domain from environment or use default
const flexileDomain = process.env.FLEXILE_DOMAIN || "flexile.dev";
const minioDomain = process.env.FLEXILE_MINIO_DOMAIN || `minio.${flexileDomain}`;

const nextConfig: NextConfig = {
  webpack: (config) => {
    Object.assign(config.resolve.alias, {
      "@tiptap/extension-bubble-menu": false,
      "@tiptap/extension-floating-menu": false,
    });
    return config;
  },
  experimental: {
    typedRoutes: true,
    testProxy: true,
    serverActions: {
      allowedOrigins: [process.env.DOMAIN, process.env.APP_DOMAIN].filter((x) => x),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flexile-(development|production)-(public|private).s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: minioDomain.replace(/\./g, '\\.'), // Escape dots for regex pattern
        port: "",
      },
      // Add support for localhost MinIO
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
    ],
  },
};

const withBundleAnalyzer = NextBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
