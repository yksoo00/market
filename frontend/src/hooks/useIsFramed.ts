"use client";
import { useSyncExternalStore } from "react";

/**
 * 이 페이지가 iframe 안에서 실행 중인지 감지합니다.
 * SSR에서는 항상 false, 클라이언트에서는 window.self !== window.top 판단합니다.
 *
 * useSyncExternalStore를 사용하는 이유:
 * - 정적 브라우저 값(window.self !== window.top)을 읽으므로 외부 스토어로 취급
 * - SSR 안전성 보장: 서버와 클라이언트 초기 렌더는 false로 동일
 * - useState + useEffect의 캐스케이딩 렌더 문제 해결
 */
export function useIsFramed(): boolean {
  return useSyncExternalStore(
    // subscribe: 이 값은 mount 후 변하지 않으므로 no-op
    () => () => {},
    // getSnapshot: 클라이언트에서 현재 값 반환
    () => window.self !== window.top,
    // getServerSnapshot: SSR에서 항상 false 반환
    () => false
  );
}
