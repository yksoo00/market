"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";

/**
 * 로그인됐을 때(방금 로그인했거나 이미 로그인 상태로 로그인 화면을 열었을 때) 돌아갈 화면으로 보낸다.
 * 홈이면 옆 칸을 모두 닫고 홈 전체 화면 (사용자 지시, 2026-10-13).
 * 다른 화면이 ?next= 로 보냈으면(옆 칸에서 세션이 끊긴 마이페이지 등) 주소 이동으로 둔다 — iframe 칸이면
 * 로그인 칸만 닫고 그 화면을 큐 규칙으로 열어(paneNavigated) 보던 다른 칸을 지키려고.
 */
export function useGoAfterLogin(): (next: string) => void {
  const router = useRouter();
  const openTile = useTileOpen();
  return useCallback(
    (next: string) => {
      if (next === "/") openTile("/", true);
      else router.replace(next);
    },
    [openTile, router],
  );
}
