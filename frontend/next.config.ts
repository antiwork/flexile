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
  // Considering various scenarios I thought and seen devs facing added this
  // This might not be enough will probably need to edit /etc/hosts
  // https://github.com/vercel/next.js/discussions/77429#discussioncomment-12711620
  allowedDevOrigins: ["flexile.dev", "app.flexile.dev", "localhost:3001", "127.0.0.1:3001"],
  experimental: {
    typedRoutes: true,
    testProxy: true,
    serverActions: {
      allowedOrigins: [
        process.env.FLEXILE_DOMAIN ?? process.env.DOMAIN,
        process.env.FLEXILE_APP_DOMAIN ?? process.env.APP_DOMAIN,
      ].filter((x): x is string => Boolean(x)),
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
        hostname: minioDomain,
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
