"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStore } from "@/store/useStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useStore();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount) => {
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                return false; // 오프라인 감지 시 즉시 재시도 차단(0초 컷)
              }
              return failureCount < 2; // 온라인 회복 및 정상 상태 시 최대 2회 허용
            },
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider refetchWhenOffline={false}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
