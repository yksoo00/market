"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { cartApi } from "@/lib/api/cart";
import { cartBadge, isCartChanged } from "@/lib/cart";
import { cart as t } from "@/messages/cart";

/**
 * 헤더 장바구니 아이콘 + 개수 배지 (로그인했을 때만 헤더가 그린다). 칸(iframe)에서 담기·빼기·견적·구매가 끝나면
 * cart-changed 신호가 오고 숫자를 다시 읽는다. 조회 실패면 배지만 숨긴다 — 헤더를 막지 않는다
 */
export function CartButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void cartApi.count().then((res) => {
        if (alive) setCount(res.ok ? res.data.count : 0);
      });
    load();
    const onMessage = (e: MessageEvent) => {
      if (isCartChanged(e, window.location.origin)) load();
    };
    window.addEventListener("message", onMessage);
    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const badge = cartBadge(count);
  return (
    // 헤더의 data-tile-from-home 으로 새 주기능 칸에 열린다 (다른 헤더 링크와 같은 규칙)
    <Link
      href="/my/cart"
      aria-label={t.header.aria(count)}
      title={t.header.label}
      className="relative w-11 h-11 flex items-center justify-center rounded-full text-on-primary hover:text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <Icon name="cart" />
      {badge && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-green text-white text-[11px] font-bold leading-4.5 text-center"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
