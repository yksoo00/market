import { MobileTabBar } from "@/components/common/MobileTabBar";
import { FilterBar } from "@/components/search/FilterBar";
import { ResultList } from "@/components/search/ResultList";
import { SearchForm } from "@/components/search/SearchForm";
import { searchListings } from "@/lib/mock/search";
import { buildSearchHref, filterListings, parseSearchParams, type RawSearchParams } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseSearchParams(await searchParams);
  // TODO(백엔드 검색 API 없음): API 연결 시 lib/api 호출로 교체하고 로딩·오류 상태 추가
  const items = filterListings(searchListings, query);
  const key = buildSearchHref(query);

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4 pb-3 @md:pb-6">
          <SearchForm key={`form-${key}`} query={query} />
          <FilterBar key={`filter-${key}`} query={query} />
          <ResultList key={key} items={items} query={query} />
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
