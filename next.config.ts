import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
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
