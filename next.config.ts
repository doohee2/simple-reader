import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.gstatic.com https://unpkg.com https://cdn.jsdelivr.net blob: data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com https://cdn.jsdelivr.net",
  "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://*.supabase.co wss://*.supabase.co https://unpkg.com https://cdn.jsdelivr.net data: blob:",
  "worker-src 'self' blob: data: https://unpkg.com https://cdn.jsdelivr.net",
  "child-src 'self' blob: data: https://unpkg.com https://cdn.jsdelivr.net",
  "frame-src 'self' https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
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
