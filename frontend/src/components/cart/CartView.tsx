"use client";

import { useEffect, useState } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { ResultList } from "@/components/search/ResultList";
import { cartApi } from "@/lib/api/cart";
import { notifyCartChanged, onCartChanged } from "@/lib/cart";
import { parseSearchParams } from "@/lib/search";
import { cart as t } from "@/messages/cart";
import { trade } from "@/messages/trade";
import type { CartItem } from "@/types/cart";
import type { ListingSearchItem } from "@/types/listing";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: CartItem[] };

// 검색 결과 표에 쓰는 조건은 장바구니에선 의미가 없다 — 빈 조건 하나로 고정
const NO_QUERY = parseSearchParams({});
const keyOf = (i: ListingSearchItem) => `${i.userId}/${i.regDate}`;

/**
 * 내 장바구니 (스펙 2026-10-21). 검색 결과 표(scope="cart")를 그대로 쓰고, 100개까지라 [더 보기] 없이 한 번에 읽는다.
 * 이 칸이나 다른 칸에서 담기·빼기·견적·구매가 끝나면(onCartChanged) 다시 읽는다. 표는 새로 마운트하지 않는다 —
 * 견적·구매 완료 안내가 떠 있는 채로 줄만 바뀐다
 */
export function CartView() {
  const openTile = useTileOpen();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const reload = () => setAttempt((n) => n + 1);

  useEffect(() => {
    let alive = true;
    void cartApi.list().then((res) => {
      if (!alive) return;
      // 다시 읽기가 실패하면 보이던 목록은 그대로 둔다 (처음 읽기만 오류 화면)
      if (res.ok) setState({ kind: "ready", items: res.data.items });
      else setState((prev) => (prev.kind === "ready" ? prev : { kind: "error" }));
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => onCartChanged(() => setAttempt((n) => n + 1)), []);

  if (state.kind === "loading") return <div className="h-40 rounded-md bg-line-2 animate-pulse" aria-busy="true" />;
  if (state.kind === "error") {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        <p className="text-[15px] font-bold text-ink">{t.page.loadFailed}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            reload();
          }}
          className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
        >
          {t.page.retry}
        </button>
      </div>
    );
  }

  const { items } = state;
  if (items.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        <p className="text-[15px] font-bold text-ink">{t.page.empty}</p>
        <button
          type="button"
          onClick={() => openTile("/search", false)}
          className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
        >
          {t.page.toSearch}
        </button>
      </div>
    );
  }

  const tradeIdByKey = new Map(items.map((i) => [keyOf(i.listing), i.tradeId]));
  const remove = async (chosen: ListingSearchItem[]) => {
    setRemoving(true);
    setRemoveError(null);
    const ids = chosen.map((i) => tradeIdByKey.get(keyOf(i))).filter((id): id is string => id !== undefined);
    const res = await cartApi.remove(ids);
    setRemoving(false);
    if (!res.ok) setRemoveError(trade.errors[res.code] ?? res.message);
    // 실패(다른 칸에서 이미 뺐거나 넘어감)해도 지금 상태로 다시 읽는다. 신호가 이 칸에도 와서 다시 읽는다
    notifyCartChanged();
    reload();
  };

  return (
    <div className="flex flex-col gap-2">
      {removeError && (
        <p role="alert" className="text-[13px] text-down">
          {removeError}
        </p>
      )}
      <ResultList
        items={items.map((i) => i.listing)}
        total={items.length}
        query={NO_QUERY}
        scope="cart"
        onRemove={(chosen) => void remove(chosen)}
        removing={removing}
      />
    </div>
  );
}
