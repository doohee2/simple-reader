import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  // react-pdf requires experimental.serverComponentsExternalPackages or similar if SSR is not disabled, but we are using next/dynamic with ssr: false, so it's mostly fine.
  // But just in case, we can configure webpack if needed later.
};

export default withSerwist(nextConfig);
