import { Icon } from "@/components/common/Icon";
import { buildSearchHref, type SearchQuery } from "@/lib/search";
import { search as t } from "@/messages/search";

// 다시 검색해도 걸어 둔 필터는 유지한다 (보이는 칸은 검색어·구분뿐, 나머지는 hidden)
function filterHiddenFields(query: SearchQuery): [string, string][] {
  const href = buildSearchHref({ ...query, q: "", field: "all" });
  return [...new URLSearchParams(href.split("?")[1] ?? "")];
}

export function SearchForm({ query }: { query: SearchQuery }) {
  return (
    <form action="/search" role="search" className="w-full">
      <label htmlFor="search-q" className="sr-only">
        {t.form.label}
      </label>
      <div className="h-11 @md:h-12 flex items-stretch rounded-md @md:rounded-lg border-2 border-primary bg-surface overflow-hidden">
        <select
          name="field"
          defaultValue={query.field}
          aria-label={t.form.fieldLabel}
          className="w-18 @md:w-28 px-2 @md:px-3 border-r border-line bg-primary-soft text-primary-dark text-sm font-medium outline-none"
        >
          <option value="all">{t.form.fields.all}</option>
          <option value="name">{t.form.fields.name}</option>
          <option value="brand">{t.form.fields.brand}</option>
        </select>
        <div className="grow min-w-0 flex items-center gap-2.5 px-3 @md:px-3.5 text-ink-2">
          <Icon name="search" strokeWidth={2} />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder={t.form.placeholder}
            className="grow min-w-0 bg-transparent outline-none text-[15px] @md:text-base text-ink placeholder:text-ink-3"
          />
        </div>
        {filterHiddenFields(query).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button
          type="submit"
          className="w-16 @md:w-26 bg-primary text-white text-sm @md:text-base font-bold hover:bg-primary-dark"
        >
          {t.form.button}
        </button>
      </div>
    </form>
  );
}
