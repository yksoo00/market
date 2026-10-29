import type { SearchQuery } from "@/lib/search";
import type { TradeScopes } from "@/types/trade";

// 검색 화면 맨 위 범위 탭 (설계 2026-10-27 PR 4). 내 데이터가 있는 범위만 탭이 생긴다.
export type ScopeTab = "all" | "mine" | "purchased";

/** 보일 탭. 내 판매·내 구매 둘 다 없거나 아직 모르면(비로그인·조회 전·실패) 빈 배열 = 탭 줄 없음 */
export function scopeTabs(scopes: TradeScopes | null): ScopeTab[] {
  if (!scopes || (!scopes.sales && !scopes.purchases)) return [];
  return ["all", ...(scopes.sales ? (["mine"] as const) : []), ...(scopes.purchases ? (["purchased"] as const) : [])];
}

export function tabOf(query: Pick<SearchQuery, "mine" | "purchased">): ScopeTab {
  return query.mine ? "mine" : query.purchased ? "purchased" : "all";
}

/** 범위만 바꾼 검색 조건 (검색어·필터는 그대로) */
export function withScope(query: SearchQuery, tab: ScopeTab): SearchQuery {
  return { ...query, mine: tab === "mine", purchased: tab === "purchased" };
}
