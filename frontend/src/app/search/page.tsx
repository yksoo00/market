import { MobileTabBar } from "@/components/common/MobileTabBar";
import { FilterBar } from "@/components/search/FilterBar";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchResults } from "@/components/search/SearchResults";
import { buildSearchHref, parseSearchParams, type RawSearchParams } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseSearchParams(await searchParams);
  const key = buildSearchHref(query);

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">
        <div className="w-full max-w-300 mx-auto flex flex-col gap-3 @md:gap-4 pb-3 @md:pb-6">
          <SearchForm key={`form-${key}`} query={query} />
          <FilterBar key={`filter-${key}`} query={query} />
          <SearchResults key={key} query={query} />
        </div>
      </main>
      <MobileTabBar active="" />
    </>
  );
}
