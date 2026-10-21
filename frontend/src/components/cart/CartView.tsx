"use client";

import { useEffect, useState } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { ResultList } from "@/components/search/ResultList";
import { cartApi } from "@/lib/api/cart";
import { notifyCartChanged } from "@/lib/cart";
import { parseSearchParams } from "@/lib/search";
import { cart as t } from "@/messages/cart";
import { trade } from "@/messages/trade";
import type { CartItem } from "@/types/cart";
import type { ListingSearchItem } from "@/types/listing";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: CartItem[] };

// 검색 결과 표에 쓰는 조건은 장바구니에선 의미가 없다 — 빈 조건 하나로 고정
const NO_QUERY = parseSearchParams({});
const keyOf = (i: ListingSearchItem) => `${i.userId}/${i.regDate}`;

/** 내 장바구니 (스펙 2026-10-21). 검색 결과 표(scope="cart")를 그대로 쓰고, 100개까지라 [더 보기] 없이 한 번에 읽는다 */
export function CartView() {
  const openTile = useTileOpen();
  const [state, setState] = useState<State>({ kind: "loading" });
  // 다시 읽을 때마다 올린다 — 표를 새로 마운트해 지워진 줄의 선택이 남지 않게
  const [version, setVersion] = useState(0);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void cartApi.list().then((res) => {
      if (!alive) return;
      setState(res.ok ? { kind: "ready", items: res.data.items } : { kind: "error" });
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const reload = () => setVersion((n) => n + 1);

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
    setRemoveError(null);
    const ids = chosen.map((i) => tradeIdByKey.get(keyOf(i))).filter((id): id is string => id !== undefined);
    const res = await cartApi.remove(ids);
    if (!res.ok) setRemoveError(trade.errors[res.code] ?? res.message);
    // 실패(다른 칸에서 이미 뺐거나 넘어감)해도 지금 상태로 다시 읽는다
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
        key={version}
        items={items.map((i) => i.listing)}
        total={items.length}
        query={NO_QUERY}
        scope="cart"
        onRemove={(chosen) => void remove(chosen)}
        onChanged={reload}
      />
    </div>
  );
}
