"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DetailFilter } from "@/components/common/DetailFilter";
import { useCategoryTree } from "@/components/search/FilterCategoryPicker";
import { searchFilterFields } from "@/components/search/searchFilterFields";
import type { FilterValues } from "@/lib/detailFilter";
import { buildSearchHref, clearFilters, defaultStatus, type SearchQuery, type SearchScope } from "@/lib/search";
import { filterFormValues, parseFilterForm, searchFilterFormSchema } from "@/lib/validation/searchFilter";
import { search } from "@/messages/search";

const t = search.filter;

/**
 * 필터 칩 툴바 (사용자 지시 2026-10-19: 상자 + 칸 나열은 빈칸이 많고 [적용]이 칸 사이에 섞여 어색했다).
 * 칩 줄은 거래이력·활동내역과 같은 공용 부품(DetailFilter) — 여기서는 검색의 칸 정의와 주소(SearchQuery) 변환만 한다
 * (사용자 지시 2026-10-30: 검색 것을 템플릿으로). URL 이 바뀌면 페이지가 key 로 다시 마운트해 칩·칸이 URL 과 맞는다.
 */
export function FilterBar({ query, scope = "search" }: { query: SearchQuery; scope?: SearchScope }) {
  const router = useRouter();
  const tree = useCategoryTree();
  const fields = useMemo(() => searchFilterFields(defaultStatus(scope, query.purchased), tree), [scope, query.purchased, tree]);

  const apply = (values: FilterValues) => {
    // 조건이 바뀌면 1페이지부터
    router.push(buildSearchHref({ ...query, ...parseFilterForm(values), page: 1 }, scope));
  };

  return (
    <DetailFilter
      labels={{ filters: t.title, apply: t.apply, reset: t.reset, clear: t.clear }}
      fields={fields}
      schema={searchFilterFormSchema}
      values={filterFormValues(query)}
      empty={filterFormValues(clearFilters(query, scope))}
      onApply={apply}
    />
  );
}
