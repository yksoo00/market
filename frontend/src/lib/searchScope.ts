import { defaultStatus, type SearchQuery } from "@/lib/search";
import type { TradeScopes } from "@/types/trade";

// 검색 화면 맨 위 범위 탭 (설계 2026-10-27 PR 4). 내 데이터가 있는 범위만 탭이 생긴다.
export type ScopeTab = "all" | "mine" | "purchased";

/**
 * 보일 탭. 내 판매·내 구매 둘 다 없거나 아직 모르면(비로그인·조회 전·실패) 빈 배열 = 탭 줄 없음.
 * 단 지금 보는 범위가 내 판매·내 구매면 그 탭은 항상 넣는다 — 주소로 바로 왔을 때도 어디 있는지 보이고 [전체]로 돌아갈 수 있게
 */
export function scopeTabs(scopes: TradeScopes | null, current: ScopeTab = "all"): ScopeTab[] {
  const mine = scopes?.sales === true || current === "mine";
  const purchased = scopes?.purchases === true || current === "purchased";
  if (!mine && !purchased) return [];
  return ["all", ...(mine ? (["mine"] as const) : []), ...(purchased ? (["purchased"] as const) : [])];
}

export function tabOf(query: Pick<SearchQuery, "mine" | "purchased">): ScopeTab {
  return query.mine ? "mine" : query.purchased ? "purchased" : "all";
}

/** 범위만 바꾼 검색 조건 (검색어·필터는 그대로). 거래상태를 안 건드렸으면 새 범위의 기본값으로 따라간다 — 내 구매는 지난 거래도 보여야 해서 "전체" */
export function withScope(query: SearchQuery, tab: ScopeTab): SearchQuery {
  const next = { ...query, mine: tab === "mine", purchased: tab === "purchased", page: 1 };
  const untouched = query.status === defaultStatus("search", query.purchased);
  return untouched ? { ...next, status: defaultStatus("search", next.purchased) } : next;
}
