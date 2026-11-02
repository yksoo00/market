"use client";

import { FilterBar } from "@/components/search/FilterBar";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchQuery } from "@/lib/search";

/** 내 판매글 화면 본문 — 검색 결과 화면과 같은 부품. 수정은 상세 화면의 [수정]에서만 (사용자 지시 2026-11-02) */
export function MyListingsView({ query, viewKey }: { query: SearchQuery; viewKey: string }) {
  return (
    <>
      <SearchForm key={`form-${viewKey}`} query={query} scope="mine" />
      <FilterBar key={`filter-${viewKey}`} query={query} scope="mine" />
      <SearchResults key={viewKey} query={query} scope="mine" />
    </>
  );
}
