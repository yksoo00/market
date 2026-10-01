"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PaneCloseButton } from "@/components/auth/AuthSplitShell";
import { useIsFramed } from "@/hooks/useIsFramed";

interface Props {
  home: ReactNode;
  children: ReactNode;
}

// 로그인·가입 분할(AuthSplitShell)과 같은 모양: @lg 이상이면 왼쪽 홈 | 오른쪽 검색 결과 1:1.
// 좁거나 서브 타일(iframe) 안이면 결과 한 칸. 결과 칸은 자체 @container라 칸 폭이 768 미만이면
// 안쪽이 모바일 배치(카드 목록·접힌 필터)로 바뀐다.
// 왼쪽 홈 칸은 닫을 수 있다 → 결과가 전체 폭. 닫힌 상태는 이 컴포넌트 상태라 결과 화면 안에서
// 다시 검색·필터를 바꿔도(클라이언트 이동) 유지되고, 다른 화면에 갔다 오면 다시 열린다.
export function SearchSplitShell({ home, children }: Props) {
  const router = useRouter();
  const framed = useIsFramed();
  const [homeOpen, setHomeOpen] = useState(true);
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
          <PaneCloseButton onClick={() => setHomeOpen(false)} />
        </div>
      )}
      {/* 닫기 버튼은 스크롤 칸 바깥(형제)에 둬야 결과를 내려도 우상단에 고정되고(AuthSplitShell과 같음),
          안쪽 @container 밖이라 @lg 가 결과 칸이 아니라 전체 칸 폭을 본다.
          @lg 에서만 위 여백을 둬서 닫기가 검색창 버튼을 가리지 않게 한다 */}
      <div className="relative min-w-0 min-h-0">
        <div className="@container @lg:h-full @lg:overflow-y-auto @lg:pt-9">{children}</div>
        {!framed && <PaneCloseButton onClick={() => router.push("/")} className="hidden @lg:flex" />}
      </div>
    </main>
  );
}
