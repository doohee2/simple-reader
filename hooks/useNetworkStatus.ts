"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 브라우저의 online/offline 상태 및 하이브리드 능동 회선 판독기 훅.
 * 
 * 1) 마운트 시 `navigator.onLine`을 0초 컷 동기 심검(Zero-Latency).
 * 2) 가짜 온라인 신호나 서비스 워커 200 위조 캐시 충돌 방지를 위해
 *    `/manifest.json?_t=${Date.now()}`로 HEAD 요청(cache: "no-store", 타임아웃 1.2초) 능동 핑 수행.
 * 3) 화면 활성화(document.hidden === false) 시 15초 주기 및 onfocus/ononline 이벤트에 바인딩.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const checkNetworkStatus = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200); // 최대 1.2초 타임아웃

      // 서비스 워커 위조 응답 및 브라우저 캐시 방지를 위해 no-store 적용
      const response = await fetch(`/manifest.json?_t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(id);
      const online = response.ok;
      setIsOnline(online);
      return online;
    } catch {
      // 타임아웃 또는 회선 단절 발생 시 진짜 오프라인으로 판독
      setIsOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    // 마운트 직후 실제 통신 가능 여부 검증
    setTimeout(() => { void checkNetworkStatus(); }, 0);

    const handleOnline = () => {
      checkNetworkStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleFocus = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        checkNetworkStatus();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        checkNetworkStatus();
      }
    }, 15000); // 화면 활성화 시 15초 주기 검사

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      clearInterval(intervalId);
    };
  }, [checkNetworkStatus]);

  return { isOnline, checkNetworkStatus };
}
