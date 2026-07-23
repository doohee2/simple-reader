"use client";

import { useState, useEffect } from "react";

/**
 * 브라우저의 online/offline 상태를 실시간으로 감지하는 커스텀 훅.
 * 
 * `navigator.onLine`을 초기값으로 사용하고,
 * `window` 이벤트 리스너로 상태 변경을 추적합니다.
 * 
 * @returns {{ isOnline: boolean }} 현재 네트워크 연결 상태
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
