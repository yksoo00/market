import { HomeAuthPane } from "@/components/auth/HomeAuthPane";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { FilterBar } from "@/components/search/FilterBar";
import { ResultList } from "@/components/search/ResultList";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchSplitShell } from "@/components/search/SearchSplitShell";
import { searchListings } from "@/lib/mock/search";
import { buildSearchHref, filterListings, parseSearchParams, type RawSearchParams } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseSearchParams(await searchParams);
  // TODO(백엔드 검색 API 없음): API 연결 시 lib/api 호출로 교체하고 로딩·오류 상태 추가
  const items = filterListings(searchListings, query);
  // 홈 칸 닫기(home=0)는 결과 집합이 아니므로 key에서 빼서 목록 선택·필터 입력이 초기화되지 않게 한다
  const key = buildSearchHref({ ...query, homeClosed: undefined });

  return (
    <>
      <SearchSplitShell
        home={<HomeAuthPane />}
        homeOpen={!query.homeClosed}
        closeHomeHref={buildSearchHref({ ...query, homeClosed: true })}
      >
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4 px-4 @md:px-6 pt-3 @md:pt-5 pb-3 @md:pb-6">
          <SearchForm key={`form-${key}`} query={query} />
          <FilterBar key={`filter-${key}`} query={query} />
          <ResultList key={key} items={items} query={query} />
        </div>
      </SearchSplitShell>
      <MobileTabBar active="" />
    </>
  );
}
