import NextBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    Object.assign(config.resolve.alias, {
      "@tiptap/extension-bubble-menu": false,
      "@tiptap/extension-floating-menu": false,
    });

    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.(".svg"));

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/iu,
        resourceQuery: /url/u, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/iu,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/u] }, // exclude if *.svg?url
        use: ["@svgr/webpack"],
      },
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/iu;

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
    ],
  },
};

const withBundleAnalyzer = NextBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
