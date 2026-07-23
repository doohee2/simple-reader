import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, StaleWhileRevalidate, NetworkFirst, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. 정적 자산 (JS/CSS/폰트/이미지): CacheFirst
    // 해시가 포함된 빌드 산출물이므로 캐시 우선이 안전하고 가장 빠름
    {
      matcher: ({ request }) =>
        request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "font" ||
        request.destination === "image",
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1년
          }),
        ],
      }),
    },
    // 2. HTML 문서 (navigate): StaleWhileRevalidate
    // 캐시된 셸을 즉시 보여주고 백그라운드에서 최신 버전을 갱신
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new StaleWhileRevalidate({
        cacheName: "pages-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
          }),
        ],
      }),
    },
    // 3. Next.js RSC/데이터 (_rsc, _next/data): StaleWhileRevalidate
    // 오프라인에서도 페이지 전환이 멈추지 않도록
    {
      matcher: ({ url }) =>
        url.pathname.includes("_rsc") || url.pathname.startsWith("/_next/data"),
      handler: new StaleWhileRevalidate({
        cacheName: "rsc-data-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7일
          }),
        ],
      }),
    },
    // 4. API 호출: NetworkFirst (5초 타임아웃)
    // 최신 데이터 우선, 오프라인 시 캐시 폴백
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24, // 1일
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
