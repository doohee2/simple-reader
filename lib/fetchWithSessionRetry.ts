import { getSession, signOut } from "next-auth/react";

/**
 * 401 Unauthorized 에러 발생 시 즉시 로그아웃하지 않고, 
 * 세션을 갱신(getSession)한 후 1회 자동 재시도하는 공용 fetch 헬퍼입니다.
 */
export async function fetchWithSessionRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  onRetry?: (newSession: any) => RequestInit
): Promise<Response> {
  let response = await fetch(input, init);

  if (response.status === 401) {
    console.warn("401 Unauthorized detected. Attempting to refresh session and retry...");
    
    // getSession()을 호출하면 auth.ts의 jwt 콜백이 실행되며 토큰이 갱신(Refresh)됩니다.
    const newSession = await getSession();

    // 치명적 에러(invalid_grant 등)로 인해 갱신이 실패한 경우
    if (newSession?.error === "RefreshAccessTokenError" || !newSession) {
      console.error("Token refresh failed. Forcing logout.");
      await signOut({ callbackUrl: "/" });
      return response;
    }

    // 호출부에서 Bearer 토큰 교체 등 동적인 init 수정이 필요한 경우 onRetry 사용
    const retryInit = onRetry ? onRetry(newSession) : init;
    
    // 투명하게 1회 재시도
    response = await fetch(input, retryInit);

    if (response.status === 401) {
      console.error("Retry also failed with 401. Forcing logout.");
      await signOut({ callbackUrl: "/" });
    }
  }

  return response;
}
