"use client";
import { useEffect, useState } from "react";

/**
 * 이 페이지가 iframe 안에서 실행 중인지 감지합니다.
 * SSR에서는 항상 false, 클라이언트 마운트 후 window.self !== window.top이면 true로 갱신됩니다.
 */
export function useIsFramed(): boolean {
  const [isFramed, setIsFramed] = useState(false);

  useEffect(() => {
    setIsFramed(window.self !== window.top);
  }, []);

  return isFramed;
}
