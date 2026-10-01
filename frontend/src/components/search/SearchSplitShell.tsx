"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PaneCloseButton } from "@/components/auth/AuthSplitShell";
import { useIsFramed } from "@/hooks/useIsFramed";

interface Props {
  home: ReactNode;
  /** false면 홈 칸을 닫은 상태(URL home=0) → 결과만 전체 폭 */
  homeOpen: boolean;
  /** 홈 칸 닫기 = 지금 URL에 home=0을 붙인 주소 */
  closeHomeHref: string;
  children: ReactNode;
}

// 로그인·가입 분할(AuthSplitShell)과 같은 모양: @lg 이상이면 왼쪽 홈 | 오른쪽 검색 결과 1:1.
// 좁거나 서브 타일(iframe) 안이면 결과 한 칸. 결과 칸은 자체 @container라 칸 폭이 768 미만이면
// 안쪽이 모바일 배치(카드 목록·접힌 필터)로 바뀐다.
// 홈 칸을 닫은 상태는 URL(home=0)에 둔다 — 컴포넌트 상태면 새로고침에 다시 분할로 돌아갔다.
export function SearchSplitShell({ home, homeOpen, closeHomeHref, children }: Props) {
  const router = useRouter();
  const framed = useIsFramed();
  const split = !framed && homeOpen;

  return (
    <main
      className={
        split
          ? "flex-1 min-h-0 overflow-y-auto @lg:overflow-hidden @lg:grid @lg:grid-cols-2"
          : "flex-1 min-h-0 overflow-y-auto"
      }
    >
      {split && (
        // 닫기 버튼은 스크롤 칸의 형제로 둬야 칸을 스크롤해도 우상단에 고정된다
        <div className="hidden @lg:block relative min-h-0 border-r border-line bg-bg">
          <div className="h-full overflow-y-auto">{home}</div>
          {/* replace: 닫기를 기록에 쌓지 않아, 뒤로가기가 분할 화면을 거치지 않고 이전 화면으로 간다 */}
          <PaneCloseButton onClick={() => router.replace(closeHomeHref, { scroll: false })} />
        </div>
      )}
      {/* 결과 칸 닫기(→ 홈)는 분할일 때만. 홈을 닫아 전체 화면이면 닫을 옆 칸이 없으므로 숨긴다.
          닫기 버튼은 스크롤 칸 바깥(형제)에 둬야 결과를 내려도 우상단에 고정되고, 안쪽 @container 밖이라
          @lg 가 결과 칸이 아니라 전체 칸 폭을 본다. 분할일 때만 위 여백을 둬서 검색창 버튼을 가리지 않게 한다 */}
      <div className="relative min-w-0 min-h-0">
        <div className={`@container ${split ? "@lg:h-full @lg:overflow-y-auto @lg:pt-9" : ""}`}>{children}</div>
        {split && <PaneCloseButton onClick={() => router.push("/")} className="hidden @lg:flex" />}
      </div>
    </main>
  );
}
