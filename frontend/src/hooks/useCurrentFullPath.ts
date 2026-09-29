"use client";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 현재 경로 + 쿼리 문자열 (예: `/listings?cat=gpu`).
 * 타일 확대·경로 보고에서 쿼리가 빠지지 않게 하려고 pathname 대신 이걸 쓴다.
 *
 * useSearchParams를 쓰므로 이 훅을 부르는 컴포넌트는 반드시 `<Suspense>` 안에 둔다.
 * 그렇지 않으면 정적 프리렌더 시 빌드가 실패하거나 Suspense 경계까지 전부 CSR로 떨어진다.
 */
export function useCurrentFullPath(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search ? `${pathname}?${search}` : pathname;
}
