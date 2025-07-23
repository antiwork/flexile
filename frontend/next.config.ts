import { resolve } from "path";
import NextBundleAnalyzer from "@next/bundle-analyzer";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Load environment variables from the root .env file
config({ path: resolve(__dirname, "../.env") });

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
      allowedOrigins: [process.env.DOMAIN, process.env.APP_DOMAIN].filter((x): x is string => Boolean(x)),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flexile-(development|production)-(public|private).s3.amazonaws.com",
      },
    ],
  },
};

const withBundleAnalyzer = NextBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
