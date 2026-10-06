"use client";

import { useState } from "react";
import { FilterBar } from "@/components/search/FilterBar";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchQuery } from "@/lib/search";

/**
 * 내 판매글 화면 본문. 행을 고치는 동안 검색창·필터 바를 숨긴다 — 쓰면 URL 이 바뀌어 결과가 다시 마운트되면서
 * 저장하지 않은 수정과 올리던 파일이 경고 없이 사라진다. (숨기기만 하고 지우지 않아 필터에 입력하던 값은 남는다)
 */
export function MyListingsView({ query, viewKey }: { query: SearchQuery; viewKey: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className={editing ? "hidden" : "contents"}>
        <SearchForm key={`form-${viewKey}`} query={query} scope="mine" />
        <FilterBar key={`filter-${viewKey}`} query={query} scope="mine" />
      </div>
      <SearchResults key={viewKey} query={query} scope="mine" onEditingChange={setEditing} />
    </>
  );
}
