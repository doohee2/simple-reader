import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, StaleWhileRevalidate, NetworkFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    readonly location: { origin: string };
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. 외부(Cross-Origin) 도메인 리소스 (구글 폰트/스타일, 구글 OAuth 아바타, 외부 CDN 등): StaleWhileRevalidate
    // 우선순위 상단 배치: 당사 호스트가 아닌 외부 도메인의 이미지, 폰트, 스타일 등에 대해 백그라운드 갱신 적용.
    // Opaque(상태 코드 0) 응답 충돌이나 일시적 에러가 영구 박제되지 않도록 CacheableResponsePlugin({ statuses: [0, 200] }) 명확히 명시.
    {
      matcher: ({ request, url }) =>
        url.origin !== self.location.origin &&
        (request.destination === "image" ||
         request.destination === "font" ||
         request.destination === "style" ||
         request.destination === "script" ||
         url.hostname.includes("googleapis.com") ||
         url.hostname.includes("gstatic.com") ||
         url.hostname.includes("googleusercontent.com") ||
         url.hostname.includes("ggpht.com") ||
         url.hostname.includes("unpkg.com") ||
         url.hostname.includes("cdn.jsdelivr.net")),
      handler: new StaleWhileRevalidate({
        cacheName: "cross-origin-resources",
        plugins: [
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
          }),
        ],
      }),
    },
    // 2. 내부(Self Origin) 불변 고정 자산 (JS/CSS/폰트/로고 등 내부 정적 이미지 및 _next/static): CacheFirst
    // 해시가 포함된 빌드 산출물 및 당사 내부 자산은 1년짜리 CacheFirst로 오프라인 즉각 로딩 및 제로 레이턴시 실현
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin &&
        (request.destination === "script" ||
         request.destination === "style" ||
         request.destination === "font" ||
         request.destination === "image" ||
         url.pathname.startsWith("/_next/static/")),
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
          }),
          new ExpirationPlugin({
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1년
          }),
        ],
      }),
    },
    // 3. HTML 문서 (navigate): StaleWhileRevalidate
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
    // 4. Next.js RSC/데이터 (_rsc, _next/data): StaleWhileRevalidate
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
    // 5. API 호출: NetworkFirst (5초 타임아웃)
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
