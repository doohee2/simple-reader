import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  swcMinify: false,
  experimental: {
    esmExternals: 'loose',
  },
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  webpack: (config, { dev }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    if (dev) {
      config.devtool = 'source-map';
    }
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
