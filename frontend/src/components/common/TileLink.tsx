"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useTileWorkspace } from "@/components/common/TileWorkspaceContext";

type TileLinkProps = {
  href: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href">;

export function TileLink({ href, children, ...rest }: TileLinkProps) {
  const { openTileLink } = useTileWorkspace();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
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
