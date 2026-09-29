"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import { useIsFramed } from "@/hooks/useIsFramed";

type TileLinkProps = {
  href: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href">;

export function TileLink({ href, children, ...rest }: TileLinkProps) {
  const { openTileLink } = useTileWorkspace();
  const framed = useIsFramed();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // 서브 타일(iframe) 안에서는 타일을 열지 않고 일반 링크처럼 그 안에서만 이동한다 (스펙: 3분할은 메인에서만).
    if (framed) {
      return;
    }
    // 수정키(새 탭/새 창 등)나 가운데 클릭은 브라우저 기본 동작에 맡긴다.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    openTileLink(href);
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
