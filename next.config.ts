import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};
let config = nextConfig;

if (process.env.NODE_ENV !== "development") {
  const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
  });
  config = withSerwist(nextConfig);
}

export default config;
