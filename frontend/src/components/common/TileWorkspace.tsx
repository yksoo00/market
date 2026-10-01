"use client";

import { Suspense, type ReactNode } from "react";
import { useIsFramed } from "@/hooks/useIsFramed";
import { useReportTilePathname } from "@/hooks/useReportTilePathname";
import { TileWorkspaceProvider, useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import { TileFrame } from "@/components/common/TileFrame";

// Provider는 framed 여부와 무관하게 항상 감싼다. useIsFramed는 첫 렌더 false → iframe 안이면 true로
// 바뀌는데, 이때 루트 타입(Provider ↔ Fragment)이 바뀌면 페이지 전체가 다시 마운트되기 때문.
export function TileWorkspace({ children }: { children: ReactNode }) {
  return (
    <TileWorkspaceProvider>
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
  const { secondary } = useTileWorkspace();
  // iframe 안(서브 타일)에서는 타일 그리드를 그리지 않는다. 3분할은 메인 컨텍스트에서만.
  const tiles = framed ? [] : secondary;

  // 페이지들은 body(flex-col)의 직계 자식처럼 <main className="flex-1 min-h-0">…<MobileTabBar/>를 두므로
  // 래퍼도 flex-col이어야 main의 flex-1·min-h-0이 전처럼 동작한다.
  // 그리드 안에서도 하나의 셀로 들어가야 main·MobileTabBar가 각각 셀로 흩어지지 않는다.
  // (Header는 루트 레이아웃에서 이 분할 바깥에 있다.)
  // @container: 이 칸의 실제 폭을 기준으로 안쪽 콘텐츠가 @md:/@lg: 로 반응하게 한다
  // (타일이 열려 메인이 좁아져도, 일반 md:/lg: 처럼 브라우저 창 전체 폭을 보고 반응 안 하는 문제 방지).
  // 서브 타일(iframe)은 3분할일 때 세로가 창의 1/4 높이까지 줄어, 한 화면용(h-dvh overflow-hidden)
  // 페이지가 잘린다. framed에서만 칸 안에서 스크롤하게 하고, 직계 자식(main)이 내용 높이 밑으로
  // 눌리지 않게(min-h-fit) 한다. 칸이 충분히 크면 flex-auto라 전처럼 남는 높이를 채운다.
  const mainCell = (
    <div
      className={`@container flex flex-1 flex-col min-h-0 min-w-0 ${
        framed ? "overflow-y-auto *:flex-auto *:min-h-fit" : "overflow-hidden"
      }`}
    >
      {main}
    </div>
  );

  if (tiles.length === 0) {
    return <div className="flex flex-1 flex-col min-h-0 w-full">{mainCell}</div>;
  }

  if (tiles.length === 1) {
    return (
      <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-1 h-full w-full">
        {mainCell}
        <TileFrame key={tiles[0].key} tile={tiles[0]} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-1 h-full w-full">
      {mainCell}
      <div className="grid grid-rows-2 h-full min-h-0">
        <TileFrame key={tiles[0].key} tile={tiles[0]} />
        <TileFrame key={tiles[1].key} tile={tiles[1]} />
      </div>
    </div>
  );
}
