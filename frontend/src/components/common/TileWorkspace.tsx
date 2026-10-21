"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { useIsFramed } from "@/hooks/useIsFramed";
import { useReportTilePathname } from "@/hooks/useReportTilePathname";
import { TileWorkspaceProvider, useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import { TileCloseButton, TileFrame } from "@/components/common/TileFrame";
import { HOME_KEY, isHome } from "@/lib/tileQueue";

// Provider는 framed 여부와 무관하게 항상 감싼다. useIsFramed는 첫 렌더 false → iframe 안이면 true로
// 바뀌는데, 이때 루트 타입(Provider ↔ Fragment)이 바뀌면 페이지 전체가 다시 마운트되기 때문.
// header도 Provider 안에 둔다: 헤더가 칸 목록을 보고(로그인 칸이 닫히면) 세션을 다시 확인해야 해서.
export function TileWorkspace({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <TileWorkspaceProvider>
      {header}
      {/* useSearchParams는 Suspense 밖에서 쓰면 정적 프리렌더가 깨지므로 잎 컴포넌트로 분리 */}
      <Suspense fallback={null}>
        <TilePathReporter />
      </Suspense>
      <TileGrid main={children} />
    </TileWorkspaceProvider>
  );
}

function TilePathReporter() {
  useReportTilePathname();
  return null;
}

// 모든 모드에서 루트 div와 그 첫 자식(메인 래퍼)의 위치를 같게 유지해,
// 서브 타일 개수·framed가 바뀌어도 메인(children)이 다시 마운트되지 않게 한다.
function TileGrid({ main }: { main: ReactNode }) {
  const framed = useIsFramed();
  const { panes, homeVersion, wide, close } = useTileWorkspace();
  // 배치 (decisions.md 2026-10-19): 왼쪽 = 홈(iframe, 고정), 오른쪽 위 = 주기능(주소창 칸, children), 오른쪽 아래 = 보조.
  // 주기능이 홈이면 홈 한 칸. iframe 안(서브 칸)과 모바일 폭(md 미만)에서는 분할하지 않는다.
  // 분할 여부는 주소(주기능 경로)만으로 정하고 폭·iframe 여부는 CSS(md:·framed:)로 가린다 — 하이드레이션 전 첫 화면부터
  // 분할로 그려, 한 칸으로 떴다가 분할로 바뀌며 화면이 튀고 그 사이 클릭이 엉뚱한 칸에 가는 일이 없게 (E2E 에서 발견).
  // 칸 목록을 알면 그걸(주기능 칸 = 주소창) 따른다 — 닫기·새 주기능 직후 라우터가 주소를 바꾸기 전에도 배치와 칸이 어긋나지 않게
  const pathname = usePathname();
  const split = !isHome(panes[0]?.path ?? pathname);
  // 홈 iframe·보조는 넓은 화면의 바깥 문서에서만 그린다. 숨긴(display:none) iframe 도 Chromium 은 바로 불러온다(lazy 무시).
  // 하이드레이션 전엔 빈 홈 칸 자리만 CSS 로 잡아 둔다 (첫 화면이 튀지 않게)
  const live = !framed && wide;
  // 보조는 넓은 화면에서 열었을 때만 생긴다. 좁아지면 칸 목록은 두고 화면에서만 뺀다
  const sub = split && live ? panes[1] : undefined;
  // 칸 사이 구분 (사용자 결정 2026-10-21): 칸마다 서로 꽉 차 있어 위아래·양옆 경계가 안 보인다 — 칸 사이에 간격(`line-2` 바탕이 비침)과
  // 칸마다 테두리·둥근 모서리(타일 radius 10)를 둔다. iframe 안(framed)은 한 칸 안이라 구분이 필요 없다 — 하이드레이션 전에도
  // 깜빡이지 않게 JS 상태가 아니라 CSS `framed:` 로 끈다 (위 split 주석과 같은 이유, framed 는 html[data-framed] 라 우선순위가 이긴다).
  const gutter = split;
  // 넘침 처리는 칸마다 다르다 — 주기능 칸은 아래에서 framed 여부로 이미 정하므로 여기선 빼고, iframe 을 담는 홈·보조 칸만 모서리에 맞춰 자른다
  const box = gutter ? "md:rounded-[10px] md:border md:border-line framed:rounded-none framed:border-0" : "";
  const clipBox = gutter ? `${box} md:overflow-hidden` : "";

  // 페이지들은 body(flex-col)의 직계 자식처럼 <main className="flex-1 min-h-0">…<MobileTabBar/>를 두므로
  // 래퍼도 flex-col이어야 main의 flex-1·min-h-0이 전처럼 동작한다.
  // 그리드 안에서도 하나의 셀로 들어가야 main·MobileTabBar가 각각 셀로 흩어지지 않는다.
  // (Header는 루트 레이아웃에서 이 분할 바깥에 있다.)
  // @container: 이 칸의 실제 폭을 기준으로 안쪽 콘텐츠가 @md:/@lg: 로 반응하게 한다
  // (타일이 열려 메인이 좁아져도, 일반 md:/lg: 처럼 브라우저 창 전체 폭을 보고 반응 안 하는 문제 방지).
  // 서브 타일(iframe)은 3분할일 때 세로가 창의 1/4 높이까지 줄어, 한 화면용(h-dvh overflow-hidden)
  // 페이지가 잘린다. framed에서만 칸 안에서 스크롤하게 하고, 직계 자식(main)이 내용 높이 밑으로
  // 눌리지 않게(min-h-fit) 한다. 칸이 충분히 크면 flex-auto라 전처럼 남는 높이를 채운다.
  // 주기능 칸은 DOM 에서 늘 첫 자식이고 자리는 grid 위치 클래스로만 옮긴다 — 분할이 바뀌어도 children 이 다시 마운트되지 않게
  const mainCell = (
    <div
      className={`@container relative flex flex-1 flex-col min-h-0 min-w-0 ${
        framed ? "overflow-y-auto *:flex-auto *:min-h-fit" : "overflow-hidden"
      } ${split ? `md:col-start-2 md:row-start-1 ${sub ? "md:row-span-1" : "md:row-span-2"}` : ""} ${box}`}
    >
      {main}
      {/* 분할일 때 주기능 칸에도 닫기. 닫으면 홈 한 칸 */}
      {split && panes[0] && (
        <div className="hidden md:contents framed:hidden">
          <TileCloseButton onClick={() => close(panes[0].key)} />
        </div>
      )}
    </div>
  );

  // 홈·보조 칸도 같은 grid 의 직계 자식으로 둔다. 부모가 바뀌면 React 가 TileFrame 을 다시 마운트해
  // iframe 이 새로 로드되고 입력하던 값이 사라진다 (코드리뷰). 보조가 바뀌어도 홈 칸(key 고정)은 그대로다.
  return (
    <div
      className={`flex flex-1 flex-col min-h-0 w-full ${split ? "md:grid md:grid-cols-2 md:grid-rows-2 md:h-full framed:flex" : ""} ${
        gutter ? "md:gap-2 md:p-2 md:bg-line-2 framed:gap-0 framed:p-0 framed:bg-transparent" : ""
      }`}
    >
      {mainCell}
      {split && (
        // 좁은 화면·iframe 안에선 display:none
        <div className={`hidden md:block md:col-start-1 md:row-start-1 md:row-span-2 min-h-0 framed:hidden ${clipBox}`}>
          {live && <TileFrame key={`${HOME_KEY}-${homeVersion}`} pane={{ key: HOME_KEY, path: "/" }} closable={false} />}
        </div>
      )}
      {sub && (
        <div className={`md:col-start-2 md:row-start-2 min-h-0 ${clipBox}`}>
          <TileFrame key={sub.key} pane={sub} />
        </div>
      )}
    </div>
  );
}
